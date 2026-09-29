#!/usr/bin/env bash
#
# The nightly off-platform backup of the production database, and a restore of
# every copy it takes. Run by .github/workflows/backup.yml, one phase per step;
# the runbook is "Backups and restore" in athena-platform/docs/runbooks/ONCALL.md.
#
# Why this exists. Until it did, Neon's own point-in-time history was the only
# backup: nothing was held anywhere but Neon, nothing ran on a schedule, and no
# restore had ever been tried. S3_BACKUPS_BUCKET sat in the env templates for
# months with nothing reading it, which made it look as if backups existed.
# ATHENA's members include women who have left violent partners, so a copy of
# this database is not an ordinary file. Every choice below follows from that:
#
#   - The copy is encrypted on the runner, before it leaves, to one or more age
#     public keys (BACKUP_AGE_RECIPIENTS). The private halves are held offline by
#     the people the owner chose, never in GitHub, so the bucket and the upload
#     credential can leak without exposing a single member.
#   - The bucket has to delete copies after the retention period the owner chose
#     (BACKUP_RETENTION_DAYS), and the run checks that before it takes one. A
#     backup kept forever keeps every member who has since asked to be erased.
#   - This repository is public, and so are its Actions logs. Nothing here prints
#     a row, a row count or a table's size — only table names, which are in the
#     schema anyway, and the size of the sealed file.
#   - Every copy is restored into a throwaway Postgres on the runner, in memory,
#     and every table's row count is compared with the count taken inside the
#     same snapshot pg_dump read. A copy that does not restore to exactly what
#     was read is uploaded as UNVERIFIED and the run fails, so nobody finds out
#     on the day they need it.
#
# Phases, in the order the workflow runs them:
#   check   every setting is present and well formed, and the bucket deletes
#           copies within the retention period
#   tools   installs the Postgres client of the server's major version, and age
#   dump    pg_dump of the public schema inside a held snapshot, with every
#           table's row count taken in that same snapshot
#   drill   restores the dump into a throwaway Postgres and compares the counts
#   seal    encrypts to the offline keys and uploads to the bucket
#   clean   removes the plaintext dump and the drill database (always runs)
#
# Settings (GitHub environment "production-backups"; see the runbook):
#   BACKUP_DATABASE_URL            secret  Neon DIRECT url of a read-only role
#   BACKUP_AWS_ACCESS_KEY_ID       secret  an IAM user that can only write here
#   BACKUP_AWS_SECRET_ACCESS_KEY   secret
#   BACKUP_AWS_REGION              var     e.g. ap-southeast-2
#   BACKUP_S3_BUCKET               var     a bucket used for nothing else
#   BACKUP_AGE_RECIPIENTS          var     age public keys (age1...), space separated
#   BACKUP_RETENTION_DAYS          var     how long a copy may exist, in days

set -Eeuo pipefail
umask 077
# A write to a psql that has exited should fail the phase, not kill the shell
# before it can say why.
trap '' PIPE

WORK="${BACKUP_WORK_DIR:-${RUNNER_TEMP:-/tmp}/athena-backup}"
PREFIX='database/'
DRILL_CONTAINER='athena-restore-drill'
DRILL_PORT='55432'

mkdir -p "$WORK"
chmod 700 "$WORK"

fail() {
  echo "::error::$*" >&2
  exit 1
}

notice() {
  echo "::notice::$*"
}

summary() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    printf '%s\n' "$@" >> "$GITHUB_STEP_SUMMARY"
  else
    printf '%s\n' "$@"
  fi
}

# psql and pg_dump name the host, the user and the address in their errors, and
# none of that belongs in a public log. The text inside quotes and brackets is
# replaced; what is left is still enough to tell a refused password from a
# timeout from a missing database.
redact() {
  sed -E 's/"[^"]*"/"…"/g; s/\([^)]*\)/(…)/g; s#postgres(ql)?://[^[:space:]]+#postgresql://…#g'
}

pg() {
  local bin="$1"
  shift
  "${PG_BIN:?PG_BIN is set by the tools phase}/$bin" "$@"
}

# The same count for both sides: one line per table in the public schema,
# "Table|rows". Generated per table with \gexec, because a count has to name its
# table and the list of tables is whatever the schema is tonight.
COUNT_SQL="SELECT format('SELECT %L || ''|'' || count(*) FROM %I.%I;', c.relname, n.nspname, c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname \\gexec"

# ---------------------------------------------------------------------- check

phase_check() {
  local missing=() name
  for name in BACKUP_DATABASE_URL BACKUP_AWS_ACCESS_KEY_ID BACKUP_AWS_SECRET_ACCESS_KEY \
    BACKUP_AWS_REGION BACKUP_S3_BUCKET BACKUP_AGE_RECIPIENTS BACKUP_RETENTION_DAYS; do
    [ -n "${!name:-}" ] || missing+=("$name")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    summary '### No backup was taken' '' \
      'These settings are missing from the `production-backups` environment:' ''
    for name in "${missing[@]}"; do summary "- \`$name\`"; done
    summary '' 'Nothing is backed up off Neon until they are set. See "Backups and restore" in `athena-platform/docs/runbooks/ONCALL.md`.'
    fail "No backup was taken: ${missing[*]} not set in the production-backups environment. See ONCALL.md, \"Backups and restore\"."
  fi

  case "$BACKUP_DATABASE_URL" in
    postgres://* | postgresql://*) ;;
    *) fail 'BACKUP_DATABASE_URL is not a postgres:// or postgresql:// URL.' ;;
  esac
  # Neon's pooled host runs PgBouncer in transaction mode, which cannot hold the
  # snapshot this dump is taken inside, and pg_dump through it can fail halfway.
  if [[ "$BACKUP_DATABASE_URL" == *-pooler.* ]]; then
    fail 'BACKUP_DATABASE_URL is the pooled Neon URL. Use the direct one (the host without "-pooler").'
  fi

  if ! [[ "$BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]{0,3}$ ]]; then
    fail 'BACKUP_RETENTION_DAYS must be a whole number of days, from 1 to 9999.'
  fi

  if ! [[ "$BACKUP_S3_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]]; then
    fail 'BACKUP_S3_BUCKET is not a valid bucket name (just the name, no s3:// and no path).'
  fi

  # An age X25519 recipient is "age1" and 58 bech32 characters. A typo here
  # would otherwise surface as an encryption failure after the dump was taken,
  # or worse, as a copy sealed to a key nobody holds.
  local recipient count=0
  for recipient in $BACKUP_AGE_RECIPIENTS; do
    if ! [[ "$recipient" =~ ^age1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58}$ ]]; then
      fail "BACKUP_AGE_RECIPIENTS has an entry that is not an age public key (age1 followed by 58 characters): ${recipient:0:12}…"
    fi
    count=$((count + 1))
  done
  [ "$count" -gt 0 ] || fail 'BACKUP_AGE_RECIPIENTS has no keys in it.'
  if [ "$count" -lt 2 ]; then
    notice 'Copies are sealed to one key. If its private half is lost, every copy is unreadable; a second key held by a second person removes that single point of failure.'
  fi

  export AWS_ACCESS_KEY_ID="$BACKUP_AWS_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$BACKUP_AWS_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="$BACKUP_AWS_REGION"
  check_retention
}

# The bucket's lifecycle rules are what actually delete old copies; the setting
# only says what the owner decided. This refuses to take a copy the bucket would
# keep longer than that, including, when versioning is on, the time a replaced
# or expired copy lingers as a noncurrent version.
check_retention() {
  local lifecycle err="$WORK/lifecycle.err"
  if ! lifecycle="$(aws s3api get-bucket-lifecycle-configuration --bucket "$BACKUP_S3_BUCKET" --output json 2> "$err")"; then
    if grep -q 'NoSuchLifecycleConfiguration' "$err"; then
      fail "Bucket $BACKUP_S3_BUCKET has no lifecycle rule, so copies would be kept forever, including every member who has since asked to be erased. Add the rule in ONCALL.md, \"Backups and restore\"."
    fi
    fail "Could not read the lifecycle rules of $BACKUP_S3_BUCKET: $(redact < "$err" | head -n 3)"
  fi

  local versioning
  versioning="$(aws s3api get-bucket-versioning --bucket "$BACKUP_S3_BUCKET" --query Status --output text 2> "$err")" ||
    fail "Could not read the versioning setting of $BACKUP_S3_BUCKET: $(redact < "$err" | head -n 3)"

  # Rules that apply to every object under the prefix: enabled, no tag or size
  # filter, and a prefix that the backup keys start with.
  local applicable='[.Rules[]
      | select(.Status == "Enabled")
      | (.Filter.Prefix // .Filter.And.Prefix // .Prefix // "") as $p
      | select($key | startswith($p))
      | select(.Filter.Tag == null and ((.Filter.And.Tags // []) | length) == 0)
      | select(.Filter.ObjectSizeGreaterThan == null and .Filter.ObjectSizeLessThan == null)
      | select(.Filter.And.ObjectSizeGreaterThan == null and .Filter.And.ObjectSizeLessThan == null)]'
  local expire noncurrent
  expire="$(jq -r --arg key "${PREFIX}x" "$applicable | map(.Expiration.Days // empty) | min // empty" <<< "$lifecycle")"
  noncurrent="$(jq -r --arg key "${PREFIX}x" "$applicable | map(.NoncurrentVersionExpiration.NoncurrentDays // empty) | min // empty" <<< "$lifecycle")"

  [ -n "$expire" ] ||
    fail "No enabled lifecycle rule on $BACKUP_S3_BUCKET expires objects under $PREFIX after a number of days. Add the rule in ONCALL.md, \"Backups and restore\"."

  local lifetime="$expire"
  if [ "$versioning" = 'Enabled' ] || [ "$versioning" = 'Suspended' ]; then
    [ -n "$noncurrent" ] ||
      fail "Versioning is on for $BACKUP_S3_BUCKET but no rule expires noncurrent versions under $PREFIX, so an expired copy would be kept as a noncurrent version forever."
    lifetime=$((expire + noncurrent))
  fi

  if [ "$lifetime" -gt "$BACKUP_RETENTION_DAYS" ]; then
    fail "The bucket keeps a copy for up to $lifetime days, longer than the $BACKUP_RETENTION_DAYS days in BACKUP_RETENTION_DAYS. Shorten the lifecycle rule, or change the setting if the retention decision changed."
  fi
  echo "Retention checked: the bucket deletes each copy within $lifetime days (the limit is $BACKUP_RETENTION_DAYS)."
}

# ---------------------------------------------------------------------- tools

phase_tools() {
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-common postgresql-client age > /dev/null

  local num err="$WORK/version.err"
  num="$(psql "$BACKUP_DATABASE_URL" --no-psqlrc -qAtc 'SHOW server_version_num' 2> "$err")" ||
    fail "Could not reach the database: $(redact < "$err" | head -n 3)"
  [[ "$num" =~ ^[0-9]{5,6}$ ]] || fail 'The database answered SHOW server_version_num with something that is not a version.'
  local major=$((num / 10000))

  # pg_dump refuses a server newer than itself, and the drill restores into the
  # same major, so both come from PGDG at exactly the server's version.
  sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y > /dev/null
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "postgresql-client-$major" > /dev/null

  local bin="/usr/lib/postgresql/$major/bin"
  [ -x "$bin/pg_dump" ] || fail "postgresql-client-$major did not install pg_dump at $bin."
  echo "$major" > "$WORK/major"
  if [ -n "${GITHUB_ENV:-}" ]; then
    echo "PG_BIN=$bin" >> "$GITHUB_ENV"
  fi
  echo "Server is Postgres $major; using $("$bin/pg_dump" --version)."
}

# ----------------------------------------------------------------------- dump

phase_dump() {
  local counts="$WORK/source-counts.txt" dump="$WORK/athena.dump" err="$WORK/snapshot.err"
  rm -f "$counts" "$dump"

  # One session holds a read-only, repeatable-read transaction open for the
  # whole dump and exports its snapshot. pg_dump reads through that snapshot,
  # and the row counts are taken inside it, so they describe exactly the data
  # in the file — which is what lets the drill demand an exact match rather
  # than "about the same".
  #
  # stdbuf because psql's output is a pipe here, which stdio would otherwise
  # buffer in blocks: the snapshot id could sit in psql's buffer while this
  # side waits for it. The descriptors and the pid are copied at once, because
  # bash unsets SNAP and SNAP_PID as soon as it reaps the coprocess, and under
  # `set -u` reading them after psql has exited would end the phase with
  # "unbound variable" instead of the reason psql gave.
  : > "$err"
  coproc SNAP {
    stdbuf -oL "${PG_BIN:?PG_BIN is set by the tools phase}/psql" "$BACKUP_DATABASE_URL" \
      --no-psqlrc --quiet --no-align --tuples-only -v ON_ERROR_STOP=1 2> "$err"
  }
  local to_psql="${SNAP[1]:-}" from_psql="${SNAP[0]:-}" snap_pid="${SNAP_PID:-}"
  if [ -z "$to_psql" ] || [ -z "$from_psql" ]; then
    fail "psql exited before the snapshot was taken: $(redact < "$err" | head -n 3)"
  fi

  printf '%s\n' 'BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY;' 'SELECT pg_export_snapshot();' >&"$to_psql" ||
    fail "psql exited before the snapshot was taken: $(redact < "$err" | head -n 3)"
  local snapshot=''
  read -r -t 120 snapshot <&"$from_psql" || true
  if ! [[ "$snapshot" =~ ^[0-9A-F]+-[0-9A-F]+(-[0-9]+)?$ ]]; then
    fail "Could not open a snapshot on the database: $(redact < "$err" | head -n 3)"
  fi

  printf '%s\n%s\n' "$COUNT_SQL" "SELECT '__athena_counts_end__';" >&"$to_psql" ||
    fail "psql exited while counting: $(redact < "$err" | head -n 3)"
  local line
  : > "$counts"
  while true; do
    read -r -t 900 line <&"$from_psql" || fail "Counting the tables did not finish: $(redact < "$err" | head -n 3)"
    [ "$line" = '__athena_counts_end__' ] && break
    printf '%s\n' "$line" >> "$counts"
  done
  local tables
  tables="$(wc -l < "$counts" | tr -d ' ')"
  [ "$tables" -gt 0 ] || fail 'The public schema has no tables. Is BACKUP_DATABASE_URL the production database?'
  LC_ALL=C sort -o "$counts" "$counts"

  local dump_err="$WORK/pg_dump.err"
  if ! pg pg_dump --snapshot="$snapshot" --schema=public --format=custom --compress=6 \
    --no-owner --no-privileges --file="$dump" "$BACKUP_DATABASE_URL" 2> "$dump_err"; then
    fail "pg_dump failed: $(redact < "$dump_err" | head -n 5)"
  fi

  printf '%s\n' 'COMMIT;' '\q' >&"$to_psql" || true
  if [ -n "$snap_pid" ]; then wait "$snap_pid" 2> /dev/null || true; fi

  [ -s "$dump" ] || fail 'pg_dump wrote an empty file.'
  echo "$tables" > "$WORK/tables"
  echo "Dumped the public schema: $tables tables, counted inside the snapshot the dump read."
}

# ---------------------------------------------------------------------- drill

phase_drill() {
  local major dump="$WORK/athena.dump" counts="$WORK/source-counts.txt" restored="$WORK/restored-counts.txt"
  major="$(cat "$WORK/major")"
  [ -s "$dump" ] || fail 'There is no dump to restore.'

  # In memory (tmpfs), bound to loopback, with a password made for this run and
  # thrown away with the container.
  #
  # PGDATA is set to a directory inside the tmpfs on purpose. The images up to
  # postgres:17 declare their data directory, /var/lib/postgresql/data, as a
  # volume, and a tmpfs on the parent does not cover a volume mounted beneath
  # it: the restored copy of every member's record was going to the runner's
  # disk in an anonymous volume, while this note said "in memory". Pointing
  # PGDATA into the tmpfs keeps it in memory on every major version; the
  # volume the image still creates stays empty, and `rm -v` removes it.
  local password
  password="$(openssl rand -hex 24)"
  docker rm -f -v "$DRILL_CONTAINER" > /dev/null 2>&1 || true
  docker run --detach --name "$DRILL_CONTAINER" \
    --tmpfs /var/lib/postgresql:rw \
    -e PGDATA=/var/lib/postgresql/drill \
    -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB=drill \
    -p "127.0.0.1:$DRILL_PORT:5432" "postgres:$major" > /dev/null

  # The image's first start runs a temporary server on a socket only, then the
  # real one on TCP, so asking over TCP waits for the real one.
  local ready=0 attempt
  for attempt in $(seq 1 90); do
    if pg pg_isready --host=127.0.0.1 --port="$DRILL_PORT" --username=postgres --dbname=drill > /dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  [ "$ready" = 1 ] || fail "The drill database (postgres:$major) did not start within 90 seconds."

  export PGPASSWORD="$password"
  local restore_err="$WORK/pg_restore.err"
  if ! pg pg_restore --host=127.0.0.1 --port="$DRILL_PORT" --username=postgres --dbname=drill \
    --clean --if-exists --no-owner --no-privileges --exit-on-error --single-transaction \
    "$dump" 2> "$restore_err"; then
    fail "The dump did not restore: $(redact < "$restore_err" | head -n 5)"
  fi

  printf '%s\n' "$COUNT_SQL" |
    pg psql --host=127.0.0.1 --port="$DRILL_PORT" --username=postgres --dbname=drill \
      --no-psqlrc --quiet --no-align --tuples-only -v ON_ERROR_STOP=1 > "$restored"
  unset PGPASSWORD
  LC_ALL=C sort -o "$restored" "$restored"

  if ! cmp -s "$counts" "$restored"; then
    # Names only: which tables differ is the diagnosis, and their sizes are not
    # something to put in a public log.
    local differing
    differing="$(LC_ALL=C comm -3 "$counts" "$restored" | tr -d '\t' | cut -d'|' -f1 | LC_ALL=C sort -u | paste -sd, -)"
    fail "The restore does not match what was dumped. Tables that differ: $differing"
  fi

  local tables
  tables="$(cat "$WORK/tables")"
  echo "Restore drill passed: all $tables tables restored with the same number of rows the snapshot held."
}

# ----------------------------------------------------------------------- seal

phase_seal() {
  local dump="$WORK/athena.dump"
  [ -s "$dump" ] || fail 'There is no dump to seal.'

  # DRILL_OUTCOME comes from the workflow. Anything but success means the copy
  # is kept, because a copy that might not restore is still better than none,
  # but it is named so nobody mistakes it for a verified one.
  local verified=1
  [ "${DRILL_OUTCOME:-}" = 'success' ] || verified=0

  export AWS_ACCESS_KEY_ID="$BACKUP_AWS_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$BACKUP_AWS_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="$BACKUP_AWS_REGION"

  local stamp name sealed
  stamp="$(date -u +%Y-%m-%dT%H%MZ)"
  if [ "$verified" = 1 ]; then
    name="athena-$stamp.dump.age"
  else
    name="athena-$stamp.UNVERIFIED.dump.age"
  fi
  sealed="$WORK/$name"

  local args=() recipient
  for recipient in $BACKUP_AGE_RECIPIENTS; do args+=(-r "$recipient"); done
  age --encrypt "${args[@]}" -o "$sealed" "$dump"
  [ -s "$sealed" ] || fail 'age wrote an empty file.'

  # The plaintext goes as soon as the sealed copy exists; the clean phase
  # removes it again in case this phase never got here.
  shred -u "$dump" 2> /dev/null || rm -f "$dump"

  local key="$PREFIX$name" err="$WORK/upload.err"
  if ! aws s3 cp "$sealed" "s3://$BACKUP_S3_BUCKET/$key" --only-show-errors 2> "$err"; then
    fail "Upload to s3://$BACKUP_S3_BUCKET/$key failed: $(redact < "$err" | head -n 3)"
  fi

  local size
  size="$(du -m "$sealed" | cut -f1)"
  rm -f "$sealed"

  summary '### Database backup' '' \
    "- Copy: \`s3://$BACKUP_S3_BUCKET/$key\` (about ${size} MB, sealed with age to $(wc -w <<< "$BACKUP_AGE_RECIPIENTS" | tr -d ' ') key(s))" \
    "- Restore drill: $([ "$verified" = 1 ] && echo 'passed — every table restored with the rows the dump read' || echo '**did not pass — this copy is UNVERIFIED**')" \
    "- Kept for: at most $BACKUP_RETENTION_DAYS days (checked against the bucket's lifecycle rules before the copy was taken)"
  echo "Uploaded $key."
  [ "$verified" = 1 ] || fail "The copy was uploaded as $key, but it did not pass the restore drill."
}

# ---------------------------------------------------------------------- clean

phase_clean() {
  docker rm -f -v "$DRILL_CONTAINER" > /dev/null 2>&1 || true
  if [ -d "$WORK" ]; then
    find "$WORK" -type f -exec shred -u {} + 2> /dev/null || true
    rm -rf "$WORK"
  fi
}

case "${1:-}" in
  check) phase_check ;;
  tools) phase_tools ;;
  dump) phase_dump ;;
  drill) phase_drill ;;
  seal) phase_seal ;;
  clean) phase_clean ;;
  *)
    echo "usage: $0 check|tools|dump|drill|seal|clean" >&2
    exit 2
    ;;
esac

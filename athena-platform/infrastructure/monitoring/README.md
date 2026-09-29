# Monitoring and alerting

**Nothing reads these files yet.** They are the rules and the scrape job for a
hosted metrics service that does not exist, because opening one needs an
account and a paging channel only the owner can set up. Until then, the only
signals anyone gets are the ones listed in
[`docs/runbooks/ONCALL.md`](../../docs/runbooks/ONCALL.md), "How anyone finds
out" — and none of them wakes a person.

| File | What it is |
|---|---|
| [`alerts.yml`](alerts.yml) | Prometheus alert rules for the API: down, missing, failing, slow, blocked, crash-looping, running out of memory. Each reads a metric the API really produces. |
| [`alerts.test.yml`](alerts.test.yml) | Unit tests for those rules. CI runs `promtool check rules` and `promtool test rules` on every push, so the rules cannot drift into something that no longer parses or no longer fires. |
| [`scrape.yml`](scrape.yml) | The scrape job the rules expect (`job_name: athena-api`, bearer token, one-minute interval). |

## Turning it on

1. **Open an account** with a service that can scrape a Prometheus endpoint over
   HTTPS with a bearer token, evaluate Prometheus alert rules, and send an alert
   to a phone as SMS or push — Grafana Cloud does all three; so does a
   self-hosted Prometheus with Alertmanager, if someone will run it. Choosing one
   is the owner's decision, and so is who carries the phone.
2. **Scrape the API.** Create the job from [`scrape.yml`](scrape.yml): name
   `athena-api`, URL `$API_URL/metrics`, bearer token = the API's
   `METRICS_TOKEN`, every 60 seconds. The job name matters: every rule selects
   `job="athena-api"`.
3. **Load the rules** from [`alerts.yml`](alerts.yml). In a self-hosted
   Prometheus, list the file under `rule_files:`. In Grafana Cloud, load it into
   the stack's Prometheus with `mimirtool rules load alerts.yml` (the stack's
   details page gives the address, the instance id and how to make the key).
4. **Route by severity.** `severity: page` (API down, errors above 5%, a crash
   loop) goes to a phone, day and night. `severity: ticket` (slow, blocked
   event loop, memory, the scrape job missing) goes to email.
5. **Fire it once.** With the scrape working, change the scraper's token to a
   wrong one for five minutes. `AthenaApiDown` should reach the phone within
   about three minutes of the change; put the right token back, and it should
   resolve. An alert path nobody has seen fire is a hope, like an untested
   restore.
6. **Add the uptime check** as well: a one-minute check of `$API_URL/readyz`
   from outside, with the same phone routing. The rules here see the process;
   only an outside check sees what a member sees when the host, DNS or TLS is the
   problem. See ONCALL.md.
7. **Update ONCALL.md**, "How anyone finds out", to say what now pages and who.

## Changing a rule

Edit [`alerts.yml`](alerts.yml), then the matching case in
[`alerts.test.yml`](alerts.test.yml) — promtool compares annotations exactly, so
a change of wording is a change to both. To run the tests locally:

```bash
cd athena-platform/infrastructure/monitoring
docker run --rm -v "$PWD:/rules" -w /rules --entrypoint /bin/promtool prom/prometheus:v2.54.1 check rules alerts.yml
docker run --rm -v "$PWD:/rules" -w /rules --entrypoint /bin/promtool prom/prometheus:v2.54.1 test rules alerts.test.yml
```

A new rule should read a metric the API emits — `src/utils/metrics.ts` and
prom-client's default Node metrics — and nothing else; a rule over a metric that
does not exist never fires, and looks exactly like one that is working.

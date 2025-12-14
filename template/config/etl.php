<?php

return [
    /*
    |--------------------------------------------------------------------------
    | ETL Log Channel
    |--------------------------------------------------------------------------
    |
    | Defines which logging channel should capture ETL pipeline lifecycle
    | entries. This allows each pipeline to emit start/success/failure events
    | without polluting the default application log. Defaults to the dedicated
    | "etl" channel declared in logging.php but can be overridden via env.
    |
    */

    'log_channel' => env('ETL_LOG_CHANNEL', 'etl'),

    /*
    |--------------------------------------------------------------------------
    | Default Chunk Size
    |--------------------------------------------------------------------------
    |
    | Pipelines that iterate over large datasets can opt into this default
    | chunk size to remain memory safe. Individual pipelines may override the
    | value per run through options passed to the EtlContext.
    |
    */

    'default_chunk' => env('ETL_DEFAULT_CHUNK', 500),

    /*
    |--------------------------------------------------------------------------
    | Default Timeout (seconds)
    |--------------------------------------------------------------------------
    |
    | Provides a guideline for how long an individual ETL run should take
    | before emitting warnings. Pipelines can evaluate this value to determine
    | whether additional alerting or retries are required.
    |
    */

    'default_timeout' => (int) env('ETL_DEFAULT_TIMEOUT', 300),
];

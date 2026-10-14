-- W.cash activity anomalies. No market, exchange or cross-chain metrics are
-- stored here; the job uses only indexed chain activity and Ironwood flows.
CREATE TABLE IF NOT EXISTS metric_anomalies (
    id bigserial PRIMARY KEY,
    date date NOT NULL,
    metric text NOT NULL,
    value numeric NOT NULL,
    zscore numeric NOT NULL,
    mean numeric NOT NULL,
    std numeric NOT NULL,
    direction text NOT NULL CHECK (direction IN ('up', 'down')),
    description text NOT NULL,
    detail text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (date, metric)
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_anomalies_date
    ON metric_anomalies (date DESC);

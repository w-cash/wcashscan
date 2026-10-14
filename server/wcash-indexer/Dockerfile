# WcashScan indexer. Wolf itself is supplied as a separately pinned service;
# this image only owns the RPC/RocksDB -> PostgreSQL ingestion process.
FROM rust:1.97-bookworm AS builder
WORKDIR /src
COPY Cargo.toml Cargo.lock rust-toolchain.toml build.rs ./
COPY proto ./proto
COPY src ./src
COPY vendor ./vendor
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libpq5 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /src/target/release/wcashscan-indexer /usr/local/bin/wcashscan-indexer
COPY schema ./schema
COPY deploy ./deploy
USER 1000:1000
ENTRYPOINT ["/usr/local/bin/wcashscan-indexer"]


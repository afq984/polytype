# Frozen JavaScript migration reference

These files preserve the live-tested decoder at jj commit `ae6ff593`.
They are only used by parity tests. Neither web demo ships or falls back to them.
New features belong in the Rust core; do not maintain a second production engine.
Retire this reference after migration confidence is sufficient, retaining the
shared acceptance fixtures and native/WASM tests.

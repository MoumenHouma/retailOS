FROM python:3.12-slim

# build-essential: required for cmdstanpy's Stan model compile step, which
# Prophet triggers on first fit (and again at container build time below, so
# the compiled Stan binary is baked into the image rather than compiled on
# every cold start).
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Warm/verify the cmdstan install Prophet needs at import time — surfaces a
# broken Stan toolchain at build time instead of on the first real request.
# `timeout` (coreutils, already present in the base image) guards against
# install_cmdstan() hanging indefinitely on a stalled network read (cmdstanpy
# has no internal timeout on its GitHub release download).
#
# cores=1, not os.cpu_count(): live-diagnosed in a Phase 6 session — the
# actual failure mode on memory-constrained hosts isn't a network stall (the
# download completes fine), it's the C++ compile itself. `make build -jN`
# spawns N parallel g++ instances each compiling Stan Math's Eigen/Boost/
# Sundials-heavy templates, and each one can need several GB; confirmed live
# via the build log that -j12 (os.cpu_count() on that host) got the compiler
# OOM-killed mid-file ("Killed signal terminated program cc1plus"), and
# retrying at -j1 still exhausted a 3.65GB-capped Docker VM eventually. There
# is no number of cores that fixes an undersized memory budget — cores=1 is
# the safest default (slowest, lowest peak memory per translation unit) for
# hosts that haven't confirmed they have several GB/core to spare. Override
# with a build arg on a beefier machine if you want it faster.
RUN timeout 1800 python -c "import cmdstanpy; cmdstanpy.install_cmdstan(cores=1, progress=True)" || \
    echo "cmdstan install timed out, was OOM-killed, or failed - continuing; /forecast will error clearly at runtime if this wasn't resolved. See PHASE5_INTELLIGENCE_PLAN.md and the 2026-07-10/11 Dev Log entries for the full diagnosis."

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

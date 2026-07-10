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
# has no internal timeout on its GitHub release download) — hit this live: a
# build hung >30min with zero output. A capped, failed install here just
# means /forecast fails clearly at runtime instead of the whole image build
# hanging forever.
RUN timeout 1800 python -c "import os, cmdstanpy; cmdstanpy.install_cmdstan(cores=os.cpu_count() or 2, progress=True)" || \
    echo "cmdstan install timed out or failed - continuing; /forecast will error clearly at runtime if this wasn't resolved"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

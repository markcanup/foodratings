#!/bin/bash

LOG=/home/codex/logs/foodratings.$$.log

set -a
source /run/secrets/foodratings-dev.env
set +a

nohup npm run dev -- --host > $LOG 2>&1 &

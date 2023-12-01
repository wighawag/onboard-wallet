#!/bin/env bash
echo -n 'doSomething();' | openssl sha256 -binary | openssl base64
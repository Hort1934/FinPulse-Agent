# Deploying FinPulse to a small VM

One Node process serves the API and the built UI on port 3001, and Caddy in front of it provides HTTPS.
The ledger and execution log are written to `/opt/finpulse/data`, which is on the boot disk, so they survive restarts and redeploys.

Tested target: Google Compute Engine **e2-micro**, Debian 13, 1 GB RAM. FinPulse can share the machine with other services: its systemd unit caps it at 300 MB of memory.

## Cost on GCP

On this setup FinPulse adds close to nothing to the bill:

- **VM and disk:** the e2-micro VM in us-central1 / us-west1 / us-east1 and its 30 GB standard disk are in the Always Free tier.
- **Network:** outbound traffic is free up to 1 GB a month. One visit loads about 0.6 MB of UI plus small API responses, so roughly 1 000–1 500 visits a month fit in the free allowance. Beyond that, egress costs cents per GB.
- **External IP:** no new IP is needed. The VM's existing external IP is reused.
- **Outbound API calls:** calls to SoSoValue, SoDEX and Gemini are inbound responses and cost almost nothing.

## 1. Open HTTP/HTTPS

In the GCP console, open the VM, click **Edit → Firewalls**, tick **Allow HTTP traffic** and **Allow HTTPS traffic**, then save.
Caddy needs port 80 to obtain the certificate.

## 2. One-time setup (on the VM)

The VM needs a hostname for HTTPS. With no domain, use sslip.io: the external IP with dots replaced by dashes, for example `35-192-142-253.sslip.io`.

Download the setup script:

```bash
curl -fsSLO https://raw.githubusercontent.com/Hort1934/FinPulse-Agent/main/deploy/setup-vm.sh
```

Run it with your hostname:

```bash
FINPULSE_HOST=35-192-142-253.sslip.io bash setup-vm.sh
```

Then add the keys (`VITE_SOSOVALUE_API_KEY`, `VITE_GEMINI_API_KEY`, `SODEX_NETWORK=testnet`):

```bash
sudo nano /opt/finpulse/.env
```

## 3. Build and start

Run the same command for every later update:

```bash
sudo bash /opt/finpulse/app/deploy/update.sh
```

Open `https://35-192-142-253.sslip.io`.

## Operations

Follow the logs:

```bash
sudo journalctl -u finpulse -f
```

Check memory and the service status:

```bash
free -m && systemctl status finpulse --no-pager
```

**Back up the ledger.** The forward-test record cannot be rebuilt, so copy `/opt/finpulse/data/*.json` regularly.

**The external IP is ephemeral.** If the VM is stopped and started, the IP and the sslip.io hostname change. Reserve the IP in the console (VPC network → IP addresses → Promote to static) before you share the link widely.

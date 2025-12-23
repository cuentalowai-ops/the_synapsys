# 🚨 SYNAPSYS Active Defense Layer – Webhook Setup Guide

## Overview

The **Active Defense Layer** is SYNAPSYS's neural response system that triggers **real-time notifications** when the compliance status transitions to `NON_COMPLIANT`. While the dashboard provides passive monitoring (visual feedback), webhooks provide **active defense** by immediately alerting your team through your preferred communication channels.

### Why Active Defense?

```
Dashboard Badge    →  Visual monitoring (passive)     ✓
Webhook Alerts     →  Active notification (defense)   ✓
Combined System    →  Complete situational awareness  ✓✓✓
```

When a compliance breach is detected, the system:
1. ⚡ **Instantly** sends an HTTP POST to your configured webhook URL
2. 📦 **Delivers** a structured JSON payload with all critical details
3. 🔔 **Notifies** your team via Slack, Telegram, Discord, or custom endpoints
4. 🛡️ **Continues** the compliance check without blocking the workflow

---

## 🔧 Configuration

### Step 1: Choose Your Notification Channel

SYNAPSYS supports any service that accepts incoming webhooks. Popular options include:

- **Slack** (team collaboration)
- **Telegram** (instant messaging)
- **Discord** (community servers)
- **Microsoft Teams** (enterprise communication)
- **Custom endpoint** (your own server/service)

### Step 2: Configure GitHub Secret

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `WEBHOOK_URL`
5. Value: Your webhook URL (see integration guides below)
6. Click **Add secret**

⚠️ **Security Note:** Never commit webhook URLs directly to your codebase. Always use GitHub Secrets.

---

## 📱 Integration Guides

### Option 1: Slack

#### Create Incoming Webhook

1. Go to your Slack workspace: `https://api.slack.com/apps`
2. Click **Create New App** → **From scratch**
3. Name your app: "SYNAPSYS Watchdog"
4. Select your workspace
5. In the app settings, go to **Incoming Webhooks**
6. Toggle **Activate Incoming Webhooks** to **On**
7. Click **Add New Webhook to Workspace**
8. Select the channel where you want notifications (e.g., `#security-alerts`)
9. Click **Allow**
10. Copy the **Webhook URL** (format: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`)

#### Configure GitHub Secret

Add the webhook URL to GitHub Secrets as `WEBHOOK_URL` (see Step 2 above).

#### Expected Slack Message Format

Slack will receive a JSON payload and display it as a code block. For better formatting, you can customize the payload in the workflow to use Slack's Block Kit format.

**Example notification:**
```
🚨 SYNAPSYS Compliance Alert 🚨
Status: NON_COMPLIANT
Timestamp: 2024-12-23 13:45:00 UTC
Repository: cuentalowai-ops/the_synapsys
Severity: CRITICAL
Action Required: Inspect compliance status immediately at the dashboard
```

---

### Option 2: Telegram

#### Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Choose a name for your bot (e.g., "SYNAPSYS Watchdog")
4. Choose a username (e.g., "synapsys_watchdog_bot")
5. BotFather will provide you with an **HTTP API token**

#### Get Your Chat ID

1. Send a message to your bot
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find the `"chat":{"id":` field in the JSON response
4. Copy your chat ID (it's usually a number like `123456789`)

#### Configure Webhook URL

Your webhook URL format for Telegram:
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage?chat_id=<YOUR_CHAT_ID>&parse_mode=HTML
```

**Example:**
```
https://api.telegram.org/bot6234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw/sendMessage?chat_id=123456789&parse_mode=HTML
```

⚠️ **Note:** The current payload sends JSON. For Telegram, you may need to modify the workflow to send `text` parameter instead. See Custom Payload section below.

#### Alternative: Telegram Webhook Proxy

For easier integration, consider using services like:
- **IFTTT** (If This Then That)
- **Zapier**
- **n8n** (self-hosted automation)

These services can receive the JSON webhook and format it properly for Telegram.

---

### Option 3: Discord

#### Create Discord Webhook

1. Open your Discord server
2. Go to **Server Settings** → **Integrations**
3. Click **Create Webhook** (or **View Webhooks** if you already have some)
4. Click **New Webhook**
5. Name it: "SYNAPSYS Watchdog"
6. Select the channel for notifications (e.g., `#security-alerts`)
7. Click **Copy Webhook URL**

#### Configure GitHub Secret

Add the Discord webhook URL to GitHub Secrets as `WEBHOOK_URL`.

**Discord webhook format:**
```
https://discord.com/api/webhooks/1234567890/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

#### Customize for Discord (Optional)

Discord supports rich embeds. To use Discord's format, you can modify the workflow payload to use Discord's embed structure:

```json
{
  "embeds": [{
    "title": "🚨 SYNAPSYS Compliance Alert",
    "description": "System status: NON_COMPLIANT",
    "color": 15158332,
    "fields": [
      {"name": "Repository", "value": "cuentalowai-ops/the_synapsys", "inline": true},
      {"name": "Severity", "value": "CRITICAL", "inline": true},
      {"name": "Timestamp", "value": "2024-12-23 13:45:00 UTC", "inline": false}
    ]
  }]
}
```

---

### Option 4: Microsoft Teams

#### Create Incoming Webhook

1. Open Microsoft Teams
2. Navigate to the channel where you want notifications
3. Click the **...** (More options) next to the channel name
4. Select **Connectors** or **Workflows**
5. Search for **Incoming Webhook**
6. Click **Add** / **Configure**
7. Provide a name: "SYNAPSYS Watchdog"
8. Upload an icon (optional)
9. Click **Create**
10. Copy the webhook URL

#### Configure GitHub Secret

Add the Teams webhook URL to GitHub Secrets as `WEBHOOK_URL`.

---

### Option 5: Custom Endpoint

#### Create Your Own Webhook Receiver

You can create a custom endpoint on your server to receive compliance alerts. Here's a minimal example:

**Node.js/Express:**
```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/synapsys-webhook', (req, res) => {
  const alert = req.body;
  
  console.log('🚨 Compliance Alert Received:');
  console.log(`Status: ${alert.status}`);
  console.log(`Timestamp: ${alert.timestamp}`);
  console.log(`Repository: ${alert.repository}`);
  console.log(`Severity: ${alert.severity}`);
  
  // Add your custom logic here:
  // - Send email
  // - Log to database
  // - Trigger PagerDuty
  // - Update monitoring dashboard
  
  res.status(200).json({ received: true });
});

app.listen(3000, () => {
  console.log('Webhook receiver listening on port 3000');
});
```

**Python/Flask:**
```python
from flask import Flask, request, jsonify
import logging

app = Flask(__name__)

@app.route('/synapsys-webhook', methods=['POST'])
def webhook():
    alert = request.json
    
    logging.warning(f"🚨 Compliance Alert: {alert['status']}")
    logging.info(f"Timestamp: {alert['timestamp']}")
    logging.info(f"Repository: {alert['repository']}")
    logging.info(f"Severity: {alert['severity']}")
    
    # Add your custom logic here
    
    return jsonify({'received': True}), 200

if __name__ == '__main__':
    app.run(port=3000)
```

#### Expose Your Endpoint

Your webhook URL must be publicly accessible. Options:
- Deploy to cloud (AWS Lambda, Google Cloud Functions, Azure Functions)
- Use ngrok for testing: `ngrok http 3000`
- Deploy to a VPS with a public IP
- Use serverless platforms (Vercel, Netlify Functions)

---

## 📦 Payload Reference

Every webhook notification includes the following JSON payload:

```json
{
  "status": "NON_COMPLIANT",
  "timestamp": "2024-12-23 13:45:00 UTC",
  "repository": "cuentalowai-ops/the_synapsys",
  "branch": "main",
  "dashboard_url": "https://dashboard.synapsys.local",
  "commit_sha": "a1b2c3d4e5f6789...",
  "actor": "github-username",
  "severity": "CRITICAL",
  "action_required": "Inspect compliance status immediately at the dashboard",
  "workflow_run": "https://github.com/cuentalowai-ops/the_synapsys/actions/runs/123456789"
}
```

### Payload Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always `"NON_COMPLIANT"` when triggered |
| `timestamp` | string | UTC timestamp of the alert |
| `repository` | string | Full repository name |
| `branch` | string | Branch that triggered the alert (usually `main`) |
| `dashboard_url` | string | URL to the monitoring dashboard |
| `commit_sha` | string | Git commit hash that triggered the check |
| `actor` | string | GitHub username who triggered the workflow |
| `severity` | string | Alert severity level (`CRITICAL`) |
| `action_required` | string | Human-readable action to take |
| `workflow_run` | string | Direct link to the GitHub Actions run |

---

## ✅ Testing Your Webhook

### Method 1: Manual Workflow Trigger

1. Go to your repository on GitHub
2. Navigate to **Actions** tab
3. Select **SYNAPSYS - Compliance Watchdog** workflow
4. Click **Run workflow** → **Run workflow**
5. Check your notification channel

⚠️ **Note:** The webhook only triggers on `NON_COMPLIANT` status. The default report generates `COMPLIANT` status.

### Method 2: Simulate Non-Compliance

Temporarily modify the workflow to test the webhook:

1. Edit `.github/workflows/compliance-watchdog.yml`
2. In the "Generate Compliance Report" step, add `NON_COMPLIANT` to the status:
   ```yaml
   ## Current Status
   - ❌ CI pipeline: NON_COMPLIANT
   ```
3. Commit and push
4. Check your notification channel
5. Revert the change

### Method 3: Direct cURL Test

Test your webhook URL directly from terminal:

```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "NON_COMPLIANT",
    "timestamp": "2024-12-23 13:45:00 UTC",
    "repository": "cuentalowai-ops/the_synapsys",
    "branch": "main",
    "dashboard_url": "https://dashboard.synapsys.local",
    "severity": "CRITICAL",
    "action_required": "TEST MESSAGE - Inspect compliance status immediately"
  }'
```

---

## 🔍 Troubleshooting

### Webhook Not Triggering

**Problem:** No notifications received when status is NON_COMPLIANT

**Solutions:**
1. ✅ Verify `WEBHOOK_URL` secret is configured in GitHub Settings
2. ✅ Check the GitHub Actions workflow log for webhook step execution
3. ✅ Ensure the compliance report actually contains `NON_COMPLIANT` text
4. ✅ Verify the webhook URL is correct (no typos)
5. ✅ Check if your webhook endpoint is publicly accessible

### Webhook Fails But Workflow Continues

**Behavior:** This is expected! The webhook step has `continue-on-error: true`

**Explanation:** The workflow prioritizes compliance checking over notification delivery. If the webhook fails, the workflow logs a warning but continues to commit the compliance report.

### Invalid JSON in Notification

**Problem:** Notification received but JSON is malformed

**Solutions:**
1. Check special characters in commit messages or usernames
2. Ensure timestamp format is correct
3. Test payload with a JSON validator
4. Review GitHub Actions logs for payload construction

### Slack/Discord Not Formatting Properly

**Problem:** Notification appears as raw JSON

**Solutions:**
- **Slack:** Use Slack's Block Kit or Incoming Webhook with attachments
- **Discord:** Use Discord's embed format (see Discord section above)
- **Alternative:** Use a webhook proxy service (Zapier, IFTTT) to reformat

### Rate Limiting

**Problem:** Too many webhook requests in short time

**Solutions:**
1. Webhooks only trigger on `NON_COMPLIANT` status changes
2. Workflow includes `[skip ci]` flag to prevent infinite loops
3. Built-in 10-second timeout prevents hanging requests
4. Check your service's rate limit policy

---

## 🛡️ Security Best Practices

### 1. Protect Your Webhook URL
- ✅ Always use GitHub Secrets (never commit to code)
- ✅ Regenerate webhook URLs periodically
- ✅ Use HTTPS endpoints only
  
### 2. Validate Incoming Requests
If you're using a custom endpoint:
```javascript
// Verify request source (optional but recommended)
if (req.headers['user-agent'].includes('curl')) {
  // Likely from GitHub Actions
}
```

### 3. Implement Request Signing (Advanced)
For production systems, consider implementing webhook signatures:
- Use HMAC-SHA256 to sign payloads
- Add a `X-Signature` header
- Verify signature on the receiving end

### 4. Monitor Webhook Health
- Set up alerts for failed webhook deliveries
- Log all webhook attempts
- Implement retry logic if needed (handle idempotency)

---

## 🚀 Advanced Configurations

### Multiple Notification Channels

To send alerts to multiple services, you can:

**Option A:** Use a webhook aggregator service
**Option B:** Modify the workflow to call multiple webhooks:

```yaml
- name: 🚨 Alert on Non-Compliance
  if: contains(steps.generate_report.outputs.content, 'NON_COMPLIANT')
  run: |
    # Send to Slack
    if [ -n "${{ secrets.SLACK_WEBHOOK_URL }}" ]; then
      curl -X POST "${{ secrets.SLACK_WEBHOOK_URL }}" -H "Content-Type: application/json" -d "$PAYLOAD"
    fi
    
    # Send to Discord
    if [ -n "${{ secrets.DISCORD_WEBHOOK_URL }}" ]; then
      curl -X POST "${{ secrets.DISCORD_WEBHOOK_URL }}" -H "Content-Type: application/json" -d "$PAYLOAD"
    fi
    
    # Send to custom endpoint
    if [ -n "${{ secrets.WEBHOOK_URL }}" ]; then
      curl -X POST "${{ secrets.WEBHOOK_URL }}" -H "Content-Type: application/json" -d "$PAYLOAD"
    fi
```

### Custom Payload Format

To customize the payload per service:

```yaml
# For Slack with rich formatting
SLACK_PAYLOAD=$(cat <<EOF
{
  "blocks": [
    {
      "type": "header",
      "text": {"type": "plain_text", "text": "🚨 SYNAPSYS Compliance Alert"}
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Status:*\nNON_COMPLIANT"},
        {"type": "mrkdwn", "text": "*Severity:*\nCRITICAL"}
      ]
    }
  ]
}
EOF
)
```

---

## 📚 Additional Resources

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Discord Webhooks Guide](https://discord.com/developers/docs/resources/webhook)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Microsoft Teams Webhooks](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook)

---

## 🎯 Summary

| Component | Purpose | Status |
|-----------|---------|--------|
| Dashboard Badge | Visual monitoring (passive) | ✅ Implemented |
| Webhook Alerts | Active notifications (defense) | ✅ Implemented |
| GitHub Secret | Secure URL storage | ⚙️ Configuration required |
| Integration Examples | Slack, Telegram, Discord, Custom | 📚 Documented |

**Your system is now compliance-aware with active defense capabilities!**

```
┌─────────────────────────────────────┐
│  SYNAPSYS NEURAL DEFENSE MATRIX     │
├─────────────────────────────────────┤
│  Visual Layer:    Dashboard Badge   │
│  Action Layer:    Webhook Alerts    │
│  Status:          FULLY ARMED 🛡️    │
└─────────────────────────────────────┘
```

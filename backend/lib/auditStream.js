const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DescribeLogStreamsCommand,
  PutLogEventsCommand,
} = require('@aws-sdk/client-cloudwatch-logs');

const ensureDir = async (targetPath) => {
  const dir = path.dirname(targetPath);
  await fs.promises.mkdir(dir, { recursive: true });
};

const appendLine = async (filePath, line) => {
  await ensureDir(filePath);
  await fs.promises.appendFile(filePath, `${line}\n`, { encoding: 'utf8' });
};

const sendWebhook = async (url, payload) => {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AuditStream] Failed to POST webhook:', error.message);
  }
};

const ensureCloudWatchResources = async (client, logGroupName, logStreamName) => {
  try {
    await client.send(new CreateLogGroupCommand({ logGroupName }));
  } catch (error) {
    if (error.name !== 'ResourceAlreadyExistsException') {
      throw error;
    }
  }
  try {
    await client.send(new CreateLogStreamCommand({ logGroupName, logStreamName }));
  } catch (error) {
    if (error.name !== 'ResourceAlreadyExistsException') {
      throw error;
    }
  }
};

const getSequenceToken = async (client, logGroupName, logStreamName) => {
  const response = await client.send(
    new DescribeLogStreamsCommand({
      logGroupName,
      logStreamNamePrefix: logStreamName,
      limit: 1,
    }),
  );
  const stream = response.logStreams?.find((entry) => entry.logStreamName === logStreamName);
  return stream?.uploadSequenceToken;
};

const createCloudWatchSink = async ({
  logGroupName,
  logStreamName,
  region,
  accessKeyId,
  secretAccessKey,
  sessionToken,
}) => {
  if (!logGroupName || !logStreamName || !region) {
    throw new Error('CloudWatch configuration requires log group, log stream, and region.');
  }

  const credentials =
    accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey, sessionToken } : undefined;
  const client = new CloudWatchLogsClient({ region, credentials });
  await ensureCloudWatchResources(client, logGroupName, logStreamName);
  let sequenceToken = await getSequenceToken(client, logGroupName, logStreamName);

  const sendEvent = async (message) => {
    const logEvent = {
      message,
      timestamp: Date.now(),
    };
    try {
      const response = await client.send(
        new PutLogEventsCommand({
          logGroupName,
          logStreamName,
          logEvents: [logEvent],
          sequenceToken,
        }),
      );
      sequenceToken = response.nextSequenceToken;
    } catch (error) {
      if (error.name === 'InvalidSequenceTokenException') {
        sequenceToken = await getSequenceToken(client, logGroupName, logStreamName);
        await client.send(
          new PutLogEventsCommand({
            logGroupName,
            logStreamName,
            logEvents: [logEvent],
            sequenceToken,
          }),
        );
      } else if (error.name === 'ResourceNotFoundException') {
        await ensureCloudWatchResources(client, logGroupName, logStreamName);
        sequenceToken = await getSequenceToken(client, logGroupName, logStreamName);
      } else {
        // eslint-disable-next-line no-console
        console.error('[AuditStream] CloudWatch error:', error.message);
      }
    }
  };

  return sendEvent;
};

const startAuditStream = async ({ connection, logPath, webhookUrl, cloudWatch }) => {
  const client = new Client(connection);
  try {
    await client.connect();
    await client.query('LISTEN audit_event');
    // eslint-disable-next-line no-console
    console.info('[AuditStream] Listening for audit events');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AuditStream] Failed to initialise listener:', error.message);
    return null;
  }

  const sinks = [];
  if (logPath) {
    sinks.push(async (line) => appendLine(logPath, line));
  }
  if (webhookUrl) {
    sinks.push(async (line, payload) => sendWebhook(webhookUrl, payload));
  }
  if (cloudWatch?.logGroupName && cloudWatch?.logStreamName && cloudWatch?.region) {
    try {
      const sendToCloudWatch = await createCloudWatchSink(cloudWatch);
      sinks.push(async (line) => sendToCloudWatch(line));
    } catch (error) {
      console.error('[AuditStream] Failed to initialise CloudWatch sink:', error.message);
    }
  }

  client.on('notification', async ({ payload }) => {
    if (!payload) return;
    let body;
    try {
      body = JSON.parse(payload);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[AuditStream] Unable to parse audit payload:', error.message);
      return;
    }

    const enriched = {
      ...body,
      receivedAt: new Date().toISOString(),
    };
    const line = JSON.stringify(enriched);
    // eslint-disable-next-line no-console
    console.info('[AuditStream]', line);
    await Promise.all(
      sinks.map(async (sink) => {
        try {
          await sink(line, enriched);
        } catch (error) {
          console.error('[AuditStream] Sink error:', error.message);
        }
      }),
    );
  });

  client.on('error', (error) => {
    // eslint-disable-next-line no-console
    console.error('[AuditStream] Listener error:', error.message);
  });

  return client;
};

module.exports = {
  startAuditStream,
};

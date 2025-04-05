const dnsServer = require('../src/dns-server');
const DnsQueryLog = require('../src/db/models/DnsQueryLog');
const mongoose = require('mongoose');
const config = require('../config/config');

beforeAll(async () => {
  // Connect to the test database
  await mongoose.connect(config.database.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterAll(async () => {
  // Disconnect from the database
  await mongoose.disconnect();
});

describe('DNS Server', () => {
  it('should start and stop without errors', async () => {
    const started = await dnsServer.start();
    expect(started).toBe(true);

    const stopped = await dnsServer.stop();
    expect(stopped).toBe(true);
  });

  it('should log DNS queries', async () => {
    const mockRequest = {
      questions: [
        {
          name: 'example.com',
          type: 1 // A record
        }
      ]
    };

    const mockSend = jest.fn();
    const mockRemoteInfo = { address: '127.0.0.1' };

    await dnsServer.handleRequest(mockRequest, mockSend, mockRemoteInfo);

    const log = await DnsQueryLog.findOne({ domain: 'example.com' });
    expect(log).not.toBeNull();
    expect(log.clientIp).toBe('127.0.0.1');
  });
});
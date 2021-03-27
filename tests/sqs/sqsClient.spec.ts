/// <reference types="jest" />
import { SqsClient } from "../../src/sqs/sqsClient";
import AWS = require("aws-sdk");
import { SendMessageBatchRequestEntry, DeleteMessageBatchRequestEntry } from "aws-sdk/clients/sqs";
jest.mock("aws-sdk", () => {
  const SQSMocked = {
    sendMessage: jest.fn().mockReturnThis(),
    promise: jest.fn()
  };
  return {
    SQS: jest.fn(() => SQSMocked)
  };
});

describe("SqsClient", () => {
  let sqs;

  beforeEach(() => {
    jest.setTimeout(10000);
    sqs = new AWS.SQS({
      region: "us-east-1"
    });

    const responseMock = jest.fn()
      .mockResolvedValueOnce({
        Successful: [],
        Failed: []
      });
    sqs.sendMessageBatch = jest.fn(() => { return { promise: responseMock }; });
    sqs.deleteMessageBatch = jest.fn(() => { return { promise: responseMock }; });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("DELETE_BATCH", () => {
    it("will delete batch of messages from SQS", async () => {
      // ARRANGE
      const messages: DeleteMessageBatchRequestEntry[] = [{
        Id: "value",
        ReceiptHandle: "service"
      },
      {
        Id: "value",
        ReceiptHandle: "service"
      }];

      // ACT
      await new SqsClient(sqs, "https://some_url/").deleteMessageBatch(messages);

      // ASSERT
      expect(sqs.deleteMessageBatch().promise).toBeCalledTimes(1);
      expect(sqs.deleteMessageBatch).toBeCalledWith({
        "Entries": [
          {
            "Id": "value",
            "ReceiptHandle": "service"
          },
        ],
        "QueueUrl": "https://some_url/",
      });
    });

    it("will not delete batch of messages from SQS if list is empty", async () => {
      // ARRANGE
      const messages = [];

      // ACT
      await new SqsClient(sqs, "https://some_url/").deleteMessageBatch(messages);

      // ASSERT
      expect(sqs.deleteMessageBatch().promise).not.toHaveBeenCalled();
    });

    it("will remove duplicates", async () => {
      // ARRANGE
      const messages: DeleteMessageBatchRequestEntry[] = [{
        Id: "value",
        ReceiptHandle: "service"
      },
      {
        Id: "value",
        ReceiptHandle: "service"
      }];


      // ACT
      await new SqsClient(sqs, "https://some_url/").deleteMessageBatch(messages);

      // ASSERT
      expect(sqs.deleteMessageBatch).toBeCalledTimes(1);
    });

    it("will retry 3 times after the first failure", async () => {
      // ARRANGE
      const sqsMessages: DeleteMessageBatchRequestEntry[] = [{
        Id: "message-1",
        ReceiptHandle: "ReceiptHandle1"
      },
      {
        Id: "message-2",
        ReceiptHandle: "ReceiptHandle2"
      },
      {
        Id: "message-3",
        ReceiptHandle: "ReceiptHandle2"
      },
      {
        Id: "message-4",
        ReceiptHandle: "ReceiptHandle3"
      }];

      const responseMock = jest.fn()
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-2", SenderFault: false, Code: "code" },
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: []
        });

      const putRecordsMock = { promise: responseMock };
      sqs.deleteMessageBatch = jest.fn(() => { return putRecordsMock; });

      // ACT
      await new SqsClient(sqs, "https://some_url/").deleteMessageBatch(sqsMessages);

      // ASSERT
      expect(sqs.deleteMessageBatch).toBeCalledTimes(4);
    });

    it("will still fail after 3 times", async () => {
      // ARRANGE
      const sqsMessages: DeleteMessageBatchRequestEntry[] = [{
        Id: "message-1",
        ReceiptHandle: "ReceiptHandle1"
      },
      {
        Id: "message-2",
        ReceiptHandle: "ReceiptHandle2"
      },
      {
        Id: "message-3",
        ReceiptHandle: "ReceiptHandle2"
      },
      {
        Id: "message-4",
        ReceiptHandle: "ReceiptHandle3"
      }];

      const responseMock = jest.fn()
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-2", SenderFault: false, Code: "code" },
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" }
          ]
        });

      const putRecordsMock = { promise: responseMock };
      sqs.deleteMessageBatch = jest.fn(() => { return putRecordsMock; });

      // ACT
      await new SqsClient(sqs, "https://some_url/").deleteMessageBatch(sqsMessages);

      // ASSERT
      expect(sqs.deleteMessageBatch).toBeCalledTimes(5);
    });

    it("will overwrite parameter for retry", async () => {
      // ARRANGE
      const sqsMessages: DeleteMessageBatchRequestEntry[] = [{
        Id: "message-1",
        ReceiptHandle: "ReceiptHandle1"
      },
      {
        Id: "message-2",
        ReceiptHandle: "ReceiptHandle2"
      },
      {
        Id: "message-3",
        ReceiptHandle: "ReceiptHandle2"
      },
      {
        Id: "message-4",
        ReceiptHandle: "ReceiptHandle3"
      }];

      const client = new SqsClient(sqs, "https://some_url/", 1, 100);

      const responseMock = jest.fn()
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-2", SenderFault: false, Code: "code" },
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: []
        });

      const putRecordsMock = { promise: responseMock };
      sqs.deleteMessageBatch = jest.fn(() => { return putRecordsMock; });

      // ACT
      await new SqsClient(sqs, "https://some_url/").deleteMessageBatch(sqsMessages);

      // ASSERT
      expect(sqs.deleteMessageBatch).toBeCalledTimes(3);
    });
  });

  describe("SEND_BATCH", () => {
    it("will send batch of messages to the deliveable SQS", async () => {
      // ARRANGE
      const myPayload: any = {
        prop1: "prop1"
      };

      const sqsMessages: SendMessageBatchRequestEntry[] = [{
        Id: "message-123",
        MessageBody: JSON.stringify(myPayload)
      }];

      // ACT
      await new SqsClient(sqs, "https://some_url/").sendMessageBatch(sqsMessages);

      // ASSERT
      expect(sqs.sendMessageBatch().promise).toBeCalledTimes(1);
      expect(sqs.sendMessageBatch).toBeCalledWith({
        "Entries": [
          {
            "Id": "message-123",
            "MessageBody": "{\"prop1\":\"prop1\"}",
          },
        ],
        "QueueUrl": "https://some_url/",
      });
    });

    it("will not send batch of messages if messages array is empty", async () => {
      // ARRANGE
      const sqsMessages: SendMessageBatchRequestEntry[] = [];

      // ACT
      await new SqsClient(sqs, "https://some_url/").sendMessageBatch(sqsMessages);

      // ASSERT
      expect(sqs.sendMessageBatch().promise).not.toBeCalled();
    });

    it("will remove duplicates", async () => {
      // ARRANGE
      const myPayload: any = {
        prop1: "prop1"
      };

      const sqsMessages: SendMessageBatchRequestEntry[] = [{
        Id: "message-123",
        MessageBody: JSON.stringify(myPayload)
      },
      {
        Id: "message-123",
        MessageBody: JSON.stringify(myPayload)
      }];

      // ACT
      await new SqsClient(sqs, "https://some_url/").sendMessageBatch(sqsMessages);

      // ASSERT
      expect(sqs.sendMessageBatch).toBeCalledTimes(1);
    });

    it("will retry 3 times after the first failure", async () => {
      // ARRANGE
      const myPayload: any = {
        prop1: "prop1"
      };

      const sqsMessages: SendMessageBatchRequestEntry[] = [{
        Id: "message-1",
        MessageBody: JSON.stringify(myPayload)
      },
      {
        Id: "message-2",
        MessageBody: JSON.stringify(myPayload)
      },
      {
        Id: "message-3",
        MessageBody: JSON.stringify(myPayload)
      },
      {
        Id: "message-4",
        MessageBody: JSON.stringify(myPayload)
      }];

      const responseMock = jest.fn()
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-2", SenderFault: false, Code: "code" },
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: []
        });

      const putRecordsMock = { promise: responseMock };
      sqs.sendMessageBatch = jest.fn(() => { return putRecordsMock; });

      // ACT
      await new SqsClient(sqs, "https://some_url/").sendMessageBatch(sqsMessages);

      // ASSERT
      expect(sqs.sendMessageBatch).toBeCalledTimes(4);
    });

    it("will still fail after 3 times", async () => {
      // ARRANGE
      const myPayload: any = {
        prop1: "prop1"
      };

      const sqsMessages: SendMessageBatchRequestEntry[] = [{
        Id: "message-1",
        MessageBody: JSON.stringify(myPayload)
      },
      {
        Id: "message-2",
        MessageBody: JSON.stringify(myPayload)
      },
      {
        Id: "message-3",
        MessageBody: JSON.stringify(myPayload)
      },
      {
        Id: "message-4",
        MessageBody: JSON.stringify(myPayload)
      }];

      const responseMock = jest.fn()
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-2", SenderFault: false, Code: "code" },
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" }
          ]
        });

      const putRecordsMock = { promise: responseMock };
      sqs.sendMessageBatch = jest.fn(() => { return putRecordsMock; });

      // ACT
      await new SqsClient(sqs, "https://some_url/").sendMessageBatch(sqsMessages);

      // ASSERT
      expect(sqs.sendMessageBatch).toBeCalledTimes(5);
    });

    it("will overwrite parameter for retry", async () => {
      // ARRANGE
      const myPayload: any = {
        prop1: "prop1"
      };

      const sqsMessages: SendMessageBatchRequestEntry[] = [{
        Id: "message-1",
        MessageBody: JSON.stringify(myPayload)
      },
      {
        Id: "message-2",
        MessageBody: JSON.stringify(myPayload)
      },
      {
        Id: "message-3",
        MessageBody: JSON.stringify(myPayload)
      },
      {
        Id: "message-4",
        MessageBody: JSON.stringify(myPayload)
      }];

      const responseMock = jest.fn()
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-2", SenderFault: false, Code: "code" },
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" },
            { Id: "message-4", SenderFault: false, Code: "code" }
          ]
        })
        .mockResolvedValueOnce({
          Failed: [
            { Id: "message-3", SenderFault: false, Code: "code" }
          ]
        });

      const putRecordsMock = { promise: responseMock };
      sqs.sendMessageBatch = jest.fn(() => { return putRecordsMock; });

      // ACT
      await new SqsClient(sqs, "https://some_url/", 1, 100).sendMessageBatch(sqsMessages);

      // ASSERT
      expect(sqs.sendMessageBatch).toBeCalledTimes(3);
    });
  });

  it("send message to SQS", async () => {
    // ARRANGE
    const myPayload: any = {
      prop1: "prop1"
    };

    // ACT
    await new SqsClient(sqs, "https://some_url/").send(myPayload);

    // ASSERT
    expect(sqs.sendMessage).toHaveBeenCalled();
    expect(sqs.sendMessage).toHaveBeenCalledWith({
      "MessageBody": "{\"prop1\":\"prop1\"}",
      "QueueUrl": "https://some_url/"
    });
  });
});
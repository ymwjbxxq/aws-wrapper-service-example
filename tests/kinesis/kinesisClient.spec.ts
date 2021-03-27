/// <reference types="jest" />
import { KinesisClient } from "../../src/kinesis/kinesisClient"
import { KinesisPutRecordDetails } from "../../src/kinesis/kinesisPutRecordDetails";
import AWS = require("aws-sdk");
jest.mock('aws-sdk', () => {
  const KinesisMocked = {
    promise: jest.fn()
  };
  return {
    Kinesis: jest.fn(() => KinesisMocked)
  };
});

describe("KinesisClient", () => {
  let kinesis;
  let myPayload;

  beforeEach(() => {
    jest.setTimeout(10000);
    
    myPayload = {
      prop1: "prop"
    };

    const uuidMock = require("uuid");
    uuidMock.v4 = jest.fn((): string => "00000000000000000000000000000000");

    kinesis = new AWS.Kinesis();

    const responseMock = jest.fn()
      .mockResolvedValue({
        Records: [],
        FailedRecordCount: 0
      });
    kinesis.putRecords = jest.fn(() => {
      return {
        promise: responseMock
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("GIVEN a single update record THEN send it", async () => {
    // ARRANGE
    const putDetails: KinesisPutRecordDetails = new KinesisPutRecordDetails("myStream");

    // ACT
    await new KinesisClient(kinesis).putRecords([myPayload], putDetails);

    // ASSERT
    expect(kinesis.putRecords).toHaveBeenCalledTimes(1);
    expect(kinesis.putRecords).toHaveBeenCalledWith({
      Records: [
        {
          Data: "{\"prop1\":\"prop\"}",
          PartitionKey: "00000000000000000000000000000000"
        }
      ],
      StreamName: "myStream"
    });
  });

  it("GIVEN more than 10 updates update records THEN send them grouped by 10", async () => {
    // ARRANGE
    const request = [];
    for (let index = 0; index < 15; index++) {
      request.push(myPayload);
    }

    // ACT
    await new KinesisClient(kinesis).putRecords(request, new KinesisPutRecordDetails("myStream"));

    // ASSERT
    expect(kinesis.putRecords).toHaveBeenCalledTimes(1);
    expect(kinesis.putRecords).toHaveBeenCalledWith({
      Records: [
        {
          Data: "{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}",
          PartitionKey: "00000000000000000000000000000000"
        },
        {
          Data: "{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}#-#{\"prop1\":\"prop\"}",
          PartitionKey: "00000000000000000000000000000000"
        }
      ],
      StreamName: "myStream"
    });
  });

  it("GIVEN updates to group by 1 and chunk by 1 THEN send them in different chunks", async () => {
    // ARRANGE
    const request = [];
    for (let index = 0; index < 10; index++) {
      request.push(myPayload);
    }

    // ACT
    await new KinesisClient(kinesis).putRecords(request, new KinesisPutRecordDetails("myStream", 1, 1));

    // ASSERT
    expect(kinesis.putRecords).toHaveBeenCalledTimes(10);
  });

  it("GIVEN updates to group by 2 and chunk by 2 THEN send them in different chunks with excess", async () => {
    // ARRANGE
    const request = [];
    for (let index = 0; index < 21; index++) {
      request.push(myPayload);
    }

    // ACT
    await new KinesisClient(kinesis).putRecords(request, new KinesisPutRecordDetails("myStream", 2, 2));

    // ASSERT
    expect(kinesis.putRecords).toHaveBeenCalledTimes(6);
  });

  it("GIVEN empty array in input THEN records are not sent", async () => {
    // ARRANGE
    const request = [];

    // ACT
    await new KinesisClient(kinesis).putRecords(request, new KinesisPutRecordDetails("myStream"));

    // ASSERT
    expect(kinesis.putRecords).not.toBeCalled();
  });

  it("will retry 3 times after the first failure", async () => {
    // ARRANGE
    const request = [];
    for (let index = 0; index < 100; index++) {
      request.push(myPayload);
    }

    const responseMock = jest.fn()
      .mockResolvedValueOnce({
        FailedRecordCount: 1,
        Records: [
          { ErrorCode: "boh", ErrorMessage: "message" },
          { SequenceNumber: "SequenceNumber", ShardId: "ShardId" }
        ]
      })
      .mockResolvedValueOnce({
        FailedRecordCount: 1,
        Records: [
          { ErrorCode: "boh", ErrorMessage: "message" },
          { SequenceNumber: "SequenceNumber", ShardId: "ShardId" }
        ]
      })
      .mockResolvedValueOnce({
        FailedRecordCount: 1,
        Records: [
          { ErrorCode: "boh", ErrorMessage: "message" },
          { SequenceNumber: "SequenceNumber", ShardId: "ShardId" }
        ]
      })
      .mockResolvedValueOnce({
        Records: [],
        FailedRecordCount: 0
      });

    const putRecordsMock = { promise: responseMock };
    kinesis.putRecords = jest.fn(() => { return putRecordsMock; });

    // ACT
    await new KinesisClient(kinesis).putRecords(request, new KinesisPutRecordDetails("myStream"));

    // ASSERT
    expect(kinesis.putRecords).toBeCalledTimes(4);
  });

  it("will still fail after 3 times", async () => {
    // ARRANGE
    const request = [myPayload];
    const responseMock = jest.fn()
      .mockResolvedValueOnce({
        FailedRecordCount: 1,
        Records: [
          { ErrorCode: "boh", ErrorMessage: "message" },
          { SequenceNumber: "SequenceNumber", ShardId: "ShardId" }
        ]
      })
      .mockResolvedValueOnce({
        FailedRecordCount: 1,
        Records: [
          { ErrorCode: "boh", ErrorMessage: "message" },
          { SequenceNumber: "SequenceNumber", ShardId: "ShardId" }
        ]
      })
      .mockResolvedValueOnce({
        FailedRecordCount: 1,
        Records: [
          { ErrorCode: "boh", ErrorMessage: "message" },
          { SequenceNumber: "SequenceNumber", ShardId: "ShardId" }
        ]
      })
      .mockResolvedValueOnce({
        FailedRecordCount: 1,
        Records: [
          { ErrorCode: "boh", ErrorMessage: "message" },
          { SequenceNumber: "SequenceNumber", ShardId: "ShardId" }
        ]
      })
      .mockResolvedValueOnce({
        FailedRecordCount: 1,
        Records: [
          { ErrorCode: "boh", ErrorMessage: "message" },
          { SequenceNumber: "SequenceNumber", ShardId: "ShardId" }
        ]
      });

    const putRecordsMock = { promise: responseMock };
    kinesis.putRecords = jest.fn(() => { return putRecordsMock; });

    // ACT
    await new KinesisClient(kinesis).putRecords(request, new KinesisPutRecordDetails("myStream"));

    // ASSERT
    expect(kinesis.putRecords).toBeCalledTimes(5);
  });
});
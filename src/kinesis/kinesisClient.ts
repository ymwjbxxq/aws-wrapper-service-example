import Kinesis, { PutRecordsInput, PutRecordsRequestEntry, PutRecordsOutput} from "aws-sdk/clients/kinesis";
import { v4 as uuidv4 } from "uuid";
import { KinesisPutRecordDetails } from "./kinesisPutRecordDetails";

export class KinesisClient {
  constructor(
    private readonly kinesis: Kinesis
  ) { }

  public async putRecords(records: any[], details: KinesisPutRecordDetails): Promise<void> {
    if (!records || records.length === 0) return

    const stringifiedArray = records.map(update => JSON.stringify(update));
    const groupedMessages: PutRecordsRequestEntry[] = this.chunk(stringifiedArray, details.maxMergeData)
      .map((groupArray) => groupArray.join(details.groupSeparator))
      .map((blobData) => {
        return {
          Data: blobData,
          PartitionKey: uuidv4()
        }
      });
    const messagesChunks = this.chunk(groupedMessages, details.chunksSize);

    await Promise.all(messagesChunks.map(async (batchEntries: PutRecordsRequestEntry[]) => {
      const putRecordsOutput = await this.putBachRecords(batchEntries, details);
      if (putRecordsOutput.FailedRecordCount > 0) {
        const failedMessages: PutRecordsRequestEntry[] = this.findInError(batchEntries, putRecordsOutput);
        await this.retryFailed(failedMessages, details);
      }
    }));
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunked_arr: T[][] = [];
    let index = 0;
    while (index < array.length) {
      chunked_arr.push(array.slice(index, size + index));
      index += size;
    }
    return chunked_arr;
  }

  private async putBachRecords(batchEntries: PutRecordsRequestEntry[], details: KinesisPutRecordDetails): Promise<PutRecordsOutput> {
    const records: PutRecordsInput = {
      Records: batchEntries,
      StreamName: details.streamName
    };
    return await this.kinesis.putRecords(records).promise();
  }

  private findInError(batchEntries: PutRecordsRequestEntry[], putRecordsOutput: PutRecordsOutput): PutRecordsRequestEntry[] {
    return putRecordsOutput.Records
      .flatMap((item, i) => item.ErrorCode ? i : [])
      .map(index => {
        return {
          Data: batchEntries[index].Data,
          PartitionKey: uuidv4()
        }
      });
  }

  private async retryFailed(failedMessages: PutRecordsRequestEntry[], details: KinesisPutRecordDetails, retryCount: number = 0): Promise<void> {
    if (retryCount <= details.maxRetry) {
      const chunks: PutRecordsRequestEntry[][] = this.chunk(failedMessages, details.maxMergeData);
      await Promise.all(chunks.map(async (batchEntries: PutRecordsRequestEntry[]) => {
        const putRecordsOutput = await this.putBachRecords(batchEntries, details);
        if (putRecordsOutput.FailedRecordCount > 0) {
          await this.delay(details.pause, retryCount);
          retryCount += 1;
          const failedMessages: PutRecordsRequestEntry[] = this.findInError(batchEntries, putRecordsOutput);
          await this.retryFailed(failedMessages, details, retryCount);
        }
      }));
    }
    // TODO if the last retry still return failed should go in a dead letter
  }

  protected async delay(ms: number, attempt: number): Promise<void> {
    const randomDelay = ms * (2 ** attempt);
    return new Promise(resolve => setTimeout(resolve, randomDelay));
  }
}
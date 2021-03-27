import SQS, { SendMessageBatchRequest, SendMessageBatchRequestEntry, SendMessageBatchResult } from "aws-sdk/clients/sqs";
import { BaseSQS } from "./baseSQS";

export class SendBatch extends BaseSQS {
  constructor(private readonly sqs: SQS,
              private readonly queueUrl: string,
              private readonly maxRetry: number,
              private readonly pause: number) {
    super();
  }
  
  public async sendInBatch(messages: SendMessageBatchRequestEntry[], size: number): Promise<void> {
    if (!messages || messages.length === 0) return

    const chunks: SendMessageBatchRequestEntry[][] = this.chunk(this.removeDuplicates(messages), size);
    await Promise.all(chunks.map(async (batchEntries: SendMessageBatchRequestEntry[]) => {
      const sendMessageBatchResult = await this.sendMessageBatch(batchEntries);
      if (sendMessageBatchResult.Failed.length > 0) {
        const failedMessages: SendMessageBatchRequestEntry[] = this.findInError(batchEntries, sendMessageBatchResult);
        await this.retryFailed(failedMessages, size);
      }
    }));
  }

  private async sendMessageBatch(batchEntries: SendMessageBatchRequestEntry[]): Promise<SendMessageBatchResult> {
    const message: SendMessageBatchRequest = {
      QueueUrl: this.queueUrl,
      Entries: batchEntries
    };
    return await this.sqs.sendMessageBatch(message).promise();
  }

  private findInError(batchEntries: SendMessageBatchRequestEntry[], sendMessageBatchResult: SendMessageBatchResult): SendMessageBatchRequestEntry[] {
    return batchEntries
      .filter(batch => sendMessageBatchResult.Failed.find(failed => failed.Id === batch.Id))
      .map(message => {
        return {
          Id: message.Id,
          MessageBody: message.MessageBody
        };
      });
  }

  private async retryFailed(failedMessages: SendMessageBatchRequestEntry[], size: number, retryCount: number = 0): Promise<void> {
    if (retryCount <= this.maxRetry) {
      const chunks: SendMessageBatchRequestEntry[][] = this.chunk(this.removeDuplicates(failedMessages), size);
      await Promise.all(chunks.map(async (batchEntries: SendMessageBatchRequestEntry[]) => {
        const sendMessageBatchResult = await this.sendMessageBatch(batchEntries);
        if (sendMessageBatchResult.Failed.length > 0) {
          await this.delay(this.pause, retryCount);
          retryCount += 1;
          const failedMessages: SendMessageBatchRequestEntry[] = this.findInError(batchEntries, sendMessageBatchResult);
          await this.retryFailed(failedMessages, size, retryCount);
        }
      }));
    }
    // TODO if the last retry still return failed should go in a dead letter
  }
}
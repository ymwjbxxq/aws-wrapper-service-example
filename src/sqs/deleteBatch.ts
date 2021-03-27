import SQS, { DeleteMessageBatchRequest, DeleteMessageBatchResult, DeleteMessageBatchRequestEntry } from "aws-sdk/clients/sqs";
import { BaseSQS } from "./baseSQS";

export class DeleteBatch extends BaseSQS {
  constructor(private readonly sqs: SQS,
              private readonly queueUrl: string,
              private readonly maxRetry: number,
              private readonly pause: number) {
    super();
  }
  
  public async deleteInBatch(messages: DeleteMessageBatchRequestEntry[], size: number): Promise<void> {
    if (!messages || messages.length === 0) return

    const chunks = this.chunk(this.removeDuplicates(messages), size);
    await Promise.all(chunks.map(async (batchEntries: DeleteMessageBatchRequestEntry[]) => {
      const deleteMessageBatchResult = await this.deleteMessageBatch(batchEntries);
      if (deleteMessageBatchResult.Failed.length > 0) {
        const failedMessages: DeleteMessageBatchRequestEntry[] = this.findInError(batchEntries, deleteMessageBatchResult);
        await this.retryFailed(failedMessages, size);
      }
    }));
  }

  private async deleteMessageBatch(batchEntries: DeleteMessageBatchRequestEntry[]): Promise<DeleteMessageBatchResult> {
    const message: DeleteMessageBatchRequest = {
      QueueUrl: this.queueUrl,
      Entries: batchEntries
    };
    return await this.sqs.deleteMessageBatch(message).promise();
  }

  private findInError(batchEntries: DeleteMessageBatchRequestEntry[], sendMessageBatchResult: DeleteMessageBatchResult): DeleteMessageBatchRequestEntry[] {
    return batchEntries
      .filter(batch => sendMessageBatchResult.Failed.find(failed => failed.Id === batch.Id))
      .map(message => {
        return {
          Id: message.Id,
          ReceiptHandle: message.ReceiptHandle
        };
      });
  }

  private async retryFailed(failedMessages: DeleteMessageBatchRequestEntry[], size: number, retryCount: number = 0): Promise<void> {
    if (retryCount <= this.maxRetry) {
      const chunks: DeleteMessageBatchRequestEntry[][] = this.chunk(this.removeDuplicates(failedMessages), size);
      await Promise.all(chunks.map(async (batchEntries: DeleteMessageBatchRequestEntry[]) => {
        const sendMessageBatchResult = await this.deleteMessageBatch(batchEntries);
        if (sendMessageBatchResult.Failed.length > 0) {
          await this.delay(this.pause, retryCount);
          retryCount += 1;
          const failedMessages: DeleteMessageBatchRequestEntry[] = this.findInError(batchEntries, sendMessageBatchResult);
          await this.retryFailed(failedMessages, size, retryCount);
        }
      }));
    }
    // TODO if the last retry still return failed should go in a dead letter
  }
}
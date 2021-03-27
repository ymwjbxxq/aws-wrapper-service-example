import SQS, { SendMessageBatchRequestEntry, DeleteMessageBatchRequestEntry } from "aws-sdk/clients/sqs";
import { SendBatch } from "./sendBatch";
import { DeleteBatch } from "./deleteBatch";

export class SqsClient {
  constructor(private readonly sqs: SQS, private readonly queueUrl: string, private readonly maxRetry: number = 3, private readonly pause: number = 200) {
  }

  public async send(message: any): Promise<void> {
    const params: SQS.Types.SendMessageRequest = {
      MessageBody: JSON.stringify(message),
      QueueUrl: this.queueUrl
    };
    await this.sqs.sendMessage(params).promise();
  }

  public async deleteMessageBatch(messages: DeleteMessageBatchRequestEntry[], size: number = 10): Promise<void> {
    await new DeleteBatch(this.sqs, this.queueUrl, this.maxRetry, this.pause).deleteInBatch(messages, size);
  }

  public async sendMessageBatch(messages: SendMessageBatchRequestEntry[], size: number = 10): Promise<void> {
    await new SendBatch(this.sqs, this.queueUrl, this.maxRetry, this.pause).sendInBatch(messages, size);
  }
}
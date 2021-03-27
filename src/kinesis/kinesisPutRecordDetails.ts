export class KinesisPutRecordDetails {
  constructor(public readonly streamName: string,
    public readonly maxMergeData: number = 10,
    public readonly chunksSize: number = 300,
    public readonly groupSeparator: string = "#-#",
    public readonly maxRetry: number = 3,
    public readonly pause: number = 200) { }
}
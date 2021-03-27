export class BaseSQS {
  protected chunk<T>(array: T[], size: number): T[][] {
    const chunked_arr: T[][] = [];
    let index = 0;
    while (index < array.length) {
      chunked_arr.push(array.slice(index, size + index));
      index += size;
    }
    return chunked_arr;
  }

  protected removeDuplicates<T>(array: T[]): T[] {
    return array.filter((obj, pos, arr) => {
      return arr.map(mapObj => mapObj["Id"]).indexOf(obj["Id"]) === pos;
    });
  }

  protected async delay(ms: number, attempt: number): Promise<void> {
    const randomDelay = ms * (2 ** attempt);
    return new Promise(resolve => setTimeout(resolve, randomDelay));
  }
}
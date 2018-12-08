import Deferred from "./deferred";

/*
 * Min buffer size to gracefully fix a bad value with an obvious default.
 * So caller can not defeat the purpose of batching.
 */
const MIN_BUFFER_SIZE = 5;

/*
 * Min buffer Size to flush when limit is about to reach.
 */
const MAX_BUFFER_SIZE = 100;

/*
 * Min timeout to gracefully fix a bad value with an obvious default.
 * So caller can not defeat the purpose of batching.
 */
const MIN_FLUSH_TIMEOUT = 1000;

/**
 * batch the buffer coming in, process them and then resolve
 *
 * @param size - Number
 * @param flushTimeout - Number
 */
export default function makeBatch(size: number, flushTimeout: number = 100) {
  if (size < MIN_BUFFER_SIZE) {
    console.warn(
      `warning: Gracefully fixing bad value of batch size to default ${MIN_BUFFER_SIZE}`
    );
    size = MIN_BUFFER_SIZE;
  }
  if (flushTimeout < MIN_FLUSH_TIMEOUT) {
    console.warn(
      `warning: Gracefully fixing bad value of timeout to default ${MIN_FLUSH_TIMEOUT}`
    );
    flushTimeout = MIN_FLUSH_TIMEOUT;
  }

  let timeout: any;
  let cb: Function;
  let buffer: any[] = [];

  /*
   * Process then flush the list
   */
  async function flush() {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = null;

    const currentBuffer = buffer;
    buffer = [];

    try {
      await cb(currentBuffer.map(d => d.val));
      currentBuffer.forEach(d => d.resolve(d.val));
    } catch (e) {
      currentBuffer.map(d => d.reject(e))
    }
  }

  /*
   * Start timeout to flush
   */
  async function setupTimeout() {
    if (!timeout) {
      timeout = setTimeout(async function() {
        await flush();
      }, flushTimeout);
    }
  }

  /*
   * Batcher which takes a process function
   * @param fn - Any function to process list
   */
  return function(fn: Function) {
    cb = fn;

    /*
     * Pushes each log into list
     * @param log - Any object to push into list
     */
    return async function<T>(log: T): Promise<any> {
      const d = new Deferred(log);
      const p = d.promise;

      buffer.push(d);

      if (buffer.length >= size || buffer.length === MAX_BUFFER_SIZE - 1) {
        await flush();
      } else {
        await setupTimeout();
      }

      return p;
    };
  };
}
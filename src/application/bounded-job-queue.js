export class QueueFullError extends Error {
  constructor() {
    super("The measurement queue is full");
    this.name = "QueueFullError";
    this.code = "queue_full";
  }
}
export class BoundedJobQueue {
  #capacity;
  #concurrency;
  #active = 0;
  #waiting = [];

  constructor({ capacity, concurrency }) {
    this.#capacity = capacity;
    this.#concurrency = concurrency;
  }

  get state() {
    return Object.freeze({
      active: this.#active,
      waiting: this.#waiting.length,
      capacity: this.#capacity,
      concurrency: this.#concurrency,
    });
  }

  enqueue(execute) {
    if (this.#active + this.#waiting.length >= this.#capacity) {
      throw new QueueFullError();
    }
    this.#waiting.push(execute);
    this.#drain();
  }

  #drain() {
    while (this.#active < this.#concurrency && this.#waiting.length > 0) {
      const execute = this.#waiting.shift();
      this.#active += 1;
      Promise.resolve()
        .then(execute)
        .catch(() => {
          // The owner of the job records its public failure state.
        })
        .finally(() => {
          this.#active -= 1;
          this.#drain();
        });
    }
  }
}

export class ModelError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "ModelError";
    this.status = status;
  }
}

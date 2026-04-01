export class LabelLayoutStrategy {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }

  async extractLabels() {
    throw new Error("extractLabels must be implemented by concrete layout strategies.");
  }

  async composeOutput() {
    throw new Error("composeOutput must be implemented by concrete layout strategies.");
  }
}

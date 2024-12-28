import Configuration from "./Configuration";

export default class GameUpdateFeed {
    private readonly appConfiguration: Configuration;

    constructor() {
        this.appConfiguration = new Configuration();
    }
}
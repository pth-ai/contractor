import {createLoggerForFile} from "useful";

const logger = createLoggerForFile();

export const basicLogger = logger.getAsLogger();

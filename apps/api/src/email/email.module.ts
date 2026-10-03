import { Module } from "@nestjs/common";
import { EmailWorker } from "./worker.js";

@Module({
  providers: [EmailWorker],
  exports: [EmailWorker],
})
export class EmailModule {}

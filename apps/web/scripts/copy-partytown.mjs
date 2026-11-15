import { copyLibFiles } from "@qwik.dev/partytown/utils";
await copyLibFiles(new URL("../public/~partytown/", import.meta.url).pathname);

import { readFileSync } from "node:fs";
import { test, after, before } from "node:test";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
let env;
const board = { version: 1, categories: [], tasks: [], revision: 1 };
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-daymark",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
after(async () => {
  await env?.cleanup();
});
test("only the verified owner can create and read their board", async () => {
  const owner = env
    .authenticatedContext("owner", {
      email: "dakotacsk@gmail.com",
      email_verified: true,
    })
    .firestore();
  await assertSucceeds(setDoc(doc(owner, "users/owner/boards/main"), board));
  await assertSucceeds(getDoc(doc(owner, "users/owner/boards/main")));
  await assertSucceeds(
    updateDoc(doc(owner, "users/owner/boards/main"), { revision: 2 }),
  );
  await assertFails(
    updateDoc(doc(owner, "users/owner/boards/main"), { revision: 2 }),
  );
  await assertFails(setDoc(doc(owner, "users/another/boards/main"), board));
  const guest = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(guest, "users/owner/boards/main")));
  await assertFails(setDoc(doc(guest, "users/owner/boards/main"), board));
  const friend = env
    .authenticatedContext("friend", {
      email: "friend@example.com",
      email_verified: true,
    })
    .firestore();
  await assertFails(getDoc(doc(friend, "users/owner/boards/main")));
  await assertFails(setDoc(doc(friend, "users/friend/boards/main"), board));
  const unverified = env
    .authenticatedContext("unverified", {
      email: "dakotacsk@gmail.com",
      email_verified: false,
    })
    .firestore();
  await assertFails(
    setDoc(doc(unverified, "users/unverified/boards/main"), board),
  );
  await assertFails(setDoc(doc(owner, "users/owner/boards/other"), board));
  await assertFails(
    setDoc(doc(owner, "users/owner/boards/main"), {
      ...board,
      revision: 3,
      unexpected: true,
    }),
  );
});

import { prisma } from "./db.js";

async function test() {
  try {
    await prisma.interview.findFirst();
    console.log("Success");
  } catch (err) {
    console.error("Error:", err);
  }
}
test();

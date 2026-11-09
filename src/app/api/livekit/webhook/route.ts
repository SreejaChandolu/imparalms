import { NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error("[LiveKit Webhook] LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set.");
      return new NextResponse("LiveKit server credentials missing", { status: 500 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new NextResponse("Missing Authorization signature header", { status: 400 });
    }

    const receiver = new WebhookReceiver(apiKey, apiSecret);
    const bodyText = await request.text();

    // Verifies the LiveKit signature and parses event payload
    const event = await receiver.receive(bodyText, authHeader);

    // Log participant events as specified
    if (event.event === "participant_joined") {
      console.log(
        `[LiveKit Webhook] Participant Joined -> Room: ${event.room?.name} | Identity: ${event.participant?.identity} | Name: ${event.participant?.name}`
      );
    } else if (event.event === "participant_left") {
      console.log(
        `[LiveKit Webhook] Participant Left -> Room: ${event.room?.name} | Identity: ${event.participant?.identity} | Name: ${event.participant?.name}`
      );
    } else if (event.event === "room_started") {
      console.log(`[LiveKit Webhook] Room Started -> Room: ${event.room?.name}`);
    } else if (event.event === "room_finished") {
      console.log(`[LiveKit Webhook] Room Finished -> Room: ${event.room?.name}`);
    }

    return NextResponse.json({ received: true, event: event.event });
  } catch (err: any) {
    console.error("[LiveKit Webhook] Signature verification failed:", err);
    return new NextResponse(
      err.message || "LiveKit Webhook verification error",
      { status: 400 }
    );
  }
}

---
status: approved
---

# Design brief: Rinse & Repeat

## The one spatial moment
Standing in a simulated bathtub shower, the user picks up real-sized bottles from a shelf beside the shower head, learns the proper order (shampoo, conditioner, then body wash or bar soap) through instant correct/incorrect feedback, and "uses" each one by bringing it up toward their head, where it disappears and a short tip on how to use it fades in.

## Why it belongs on glasses
- Uses: draws in the world (a full-size bathroom and bottles around you); leaves your body free (you pick up and use the products with your own hands).
- Why it's better than the phone or laptop version: on a phone you watch someone else shower. Here you do it yourself, at real scale, in the order you'll use at home, with feedback on each choice.

## Product or overlay
- Type: product. The simulated bathroom is the experience, a shower-routine trainer.
- What the real version would sense: nothing. It is a practice space, not an overlay on the user's real bathroom.
- Stand-in for the preview: "using" a product on yourself is stood in for by bringing the bottle into an invisible zone about 25 cm in front of the user's face (default). When the bottle enters the zone, it disappears with a splash sound and counts as used. The bathroom is clearly a simulated room, and the demo says so.

## Where things live
- Where the user is looking during the main task: straight ahead at the shower head and the shelf beside it, at chest height.
- Door (opening scene): in front of the user at start, about 150 cm away (default), standard size about 90 x 200 cm (default).
- Towel: hanging on a hook right next to the door, about 110 cm high (default), sized like a real hand towel, about 40 x 70 cm (default), so it is an easy grab target.
- Towel bar (bathroom): on the wall beside the user's entry point, about 100 cm high and 70 cm away (default).
- Shower head: on the wall in front of the user inside the bathtub, about 190 cm high (default).
- Shelf: on the wall beside the shower head, at chest height, about 120 cm high and about 70 cm in front of the user (default), so the bottles and the shower head are in view together.
- Bottles: four products on the shelf: shampoo, conditioner, body wash, bar soap. Real-world size, about 20 cm tall for bottles and about 9 cm for the soap (default), each with a large readable label.
- Correct/incorrect badge: appears just above the product in the user's hand.
- Tip card: a small card floating just above the shelf, about 30 x 10 cm (default), with one or two short lines of light text.
- "Learn more" button and panel: the button sits next to the tip card; the panel opens beside the shelf, never in front of the user's face.

## Hands and input
- Open the door: pinch the door handle.
- Pick up the towel: grab and drag it, then drop it on the towel bar.
- Pick up a product: grab it from the shelf.
- Wrong product: the user puts it down; if they let go anywhere, it returns to its spot on the shelf (default).
- Use a product: drag the correct bottle up toward the head until it enters the face zone (about 25 cm, default).
- Learn more: pinch the "Learn more" button; pinch again to close.
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- Opening: the door and the towel next to it, with a small hovering sign: "Don't forget your towel." The sign hides when the towel is picked up.
- After the door opens: a big bright light fills the view, then fades to show the bathroom. (White, not black, because black renders as transparent.)
- "Put your towel on the bar": shows when the bathroom appears; hides when the towel is on the bar.
- "Time to learn how to take a shower": shows when the towel lands on the bar, then fades after about 3 seconds (default) and the shower tutorial begins.
- Correct/incorrect badge: shows the moment a product is picked up. Correct shows "Correct! Now use it on yourself." Incorrect shows "Not yet. Put it back," plus a one-line hint about what comes first (for example, "Hair first, body last.").
- Tip card: shows right after a product is used (disappears in the face zone), stays about 5 seconds (default), then fades.
- "Learn more" button: shows with each tip and stays until the next product is picked up.
- Body wash or bar soap line: when either is picked up for step 3, the card adds: "Body wash: quick and easy. Bar soap: the classic. Either one works."
- Finish: after step 3, a short message: "That's the routine: shampoo, conditioner, then body wash or soap."
- If something needs attention out of view: none expected, since the shelf and shower head are in view together.

### Lesson content
1. **Shampoo first.** Tip: "Massage it into your scalp with your fingertips, not your nails. Then rinse."
   Learn more: Shampoo cleans your scalp and hair, so it goes first. Use about a coin-sized amount, work it into the scalp with your fingertips, and rinse it out fully.
2. **Conditioner second.** Tip: "Put it on the lengths and ends of your hair. Leave it for a minute or two, then rinse."
   Learn more: Conditioner softens and smooths hair after shampoo. Focus on the middle and ends rather than the scalp, leave it on briefly, then rinse.
3. **Body wash or bar soap last.** Tip: "Wash your whole body from top to bottom. Be gentle on sensitive areas."
   Learn more: Washing your body last rinses away the film shampoo and conditioner can leave on your back and chest, which can clog pores. Body wash and bar soap do the same job, so pick whichever you prefer.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Grabbing the towel beside the door and pinching the door handle opens the door; a bright light fades to show the bathroom.
2. Dropping the towel on the towel bar shows "Time to learn how to take a shower."
3. Picking up any product other than shampoo first shows the incorrect badge with "Not yet. Put it back," and releasing it returns it to the shelf.
4. Picking up the shampoo first shows "Correct! Now use it on yourself"; dragging it up into the face zone makes it disappear with a splash, and its tip card appears, then fades.
5. Completing shampoo, then conditioner, then body wash or bar soap shows each correct badge and tip in turn, and ends with the finish message. Pinching "Learn more" during any step opens that product's panel.

## Out of scope
- A demo avatar showing the motions. The user is unsure whether it's worth it; noted as a future idea.
- Simulating your own head, or scrubbing motions.
- Turning on the water or a running-water effect (default; not chosen as a done criterion).
- Hair, face and skin-type advice and ingredient education (future feature).
- Showers from around the world (future feature).
- The user's real bathroom or real products. This version is a simulated practice bathroom only.

## Risks and open questions
- Dragging a bottle toward your own face with a mouse in the preview can be fiddly, because depth is harder to control than left and right. Keep the face zone generous (about 25 cm, default) so the "use" moment is easy to trigger and to show in the demo.
- The opening sequence (door, towel, light, towel bar) adds build time before the core lesson. Build the shower lesson first, then the opening, so the core moment is never at risk.
- Feel unproven: comfort and hand tracking when lifting a bottle toward your head on real glasses.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources

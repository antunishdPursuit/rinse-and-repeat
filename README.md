# Rinse & Repeat

A Lens for Snap Spectacles (SPECS) that teaches the order of a shower routine in a simulated bedroom and bathroom: shampoo, then conditioner, then body wash or bar soap.

The bathroom is simulated. No water, avatar, or camera image of the user is involved.

## What happens

1. **Bedroom.** A sign in front of you says "Don't forget your towel! It's on the bed, to your left." A glowing ring and arrow mark the towel. Pick it up and it hangs from your hand, then stays with you.
2. **Door.** The door handle glows and a floating guide panel says "Now open the door: pinch the handle." The lever presses down, the door swings open, and a bright light fades to show the bathroom. Without the towel, the lever gives a little and springs back.
3. **Towel bar.** "Hang your towel here" sits above the towel bar on the left wall, with a glowing arrow. Pinch the bar (or drop the towel on it) and the towel drapes over it. "Time to learn how to take a shower." shows for about 3 seconds, then the guide says "Step into the bathtub."
4. **Lesson.** Standing in the tub starts the lesson: "What do you use first? Pick it up." Each product on the shelf has a name tag.
   - A wrong product shows "Not yet. Put it back." with a one-line hint, and returns to the shelf when you let go.
   - The right one shows "Correct! Now use it on yourself." and a glowing ring appears above it. Lift it into the ring and it glides to your head (or to chest height for body wash or soap), with a splash. Bringing the bottle up to your face works too.
   - A tip card shows for about 5 seconds, with a **Learn more** button that opens a short panel about that product.
   - For the last step, "Either one" sits between the body wash and the bar soap.
5. **Finish.** "That's the routine: shampoo, conditioner, then body wash or soap." Then the guide says "Want to learn more, or start over? Go to the mirror." The mirror shows details for each product and a **Start over** button. Starting over brings back the towel sign, with a "Coming soon: shower routines from around the world" note under it. That note is a placeholder for a planned feature; nothing else is built for it yet.

The floating guide panel stays in front of you and drifts back into view when you turn away. If you walk outside the rooms (or through the closed bathroom door), the view fades and a message tells you which way to turn to step back inside.

## Requirements

- Lens Studio 5.24.1 with the SPECS preview
- Packages (included in `Packages/`): Spectacles Interaction Kit 0.18, Spectacles UI Kit, LEAF 2.0.2, Bitmoji 3D

## Open and run

1. Open `RinseRepeat.esproj` in Lens Studio.
2. Use the Preview panel in Interactive mode with the SPECS device.
3. Left-click and drag to pinch and move objects; move around with the preview's keyboard and mouse navigation. A mouse drag keeps objects at a fixed distance, which is why the use ring sits above the product at the same distance.
4. On the `RinseRepeat` object, the `RinseRepeatController` component has settings:
   - `startAt`: `opening`, `towel` or `lesson`, to skip ahead.
   - `eyeLevelAssist`: also counts a product as used when it is lifted to eye level in front of you.
   - `wallMargin`: how close to a wall you can get before the stay-inside warning.
   - `tipSeconds`, `introSeconds`, `towelSnapDistance`, `faceZoneRadius`.

## Tests

The LEAF scenarios live in `Assets/Tests` and are registered in `LeafIndex.ts`.

1. Enable the `LeafIndex` object in the scene. While it is enabled, mouse input in the preview is turned off, so disable it again for manual use.
2. Run the scenarios from the LEAF panel.

| Scenario | Checks |
|---|---|
| `c1-door-opens-with-towel` | The door stays shut without the towel. Taking it hides the towel marker, lights the handle and shows the open-door prompt; the carried towel stays clear of the line of sight to the handle. The lever turns, the light fades and the towel-bar prompt shows. |
| `c2-towel-on-bar` | The bar keeps its size and has an arrow. Pinching the bar or dropping the towel hangs it; the intro message shows, then "Step into the bathtub", and standing in the tub starts the lesson. |
| `c3-wrong-product-first` | Conditioner, body wash and bar soap each show "Not yet" with a hint that stays after letting go, and return to the shelf. A correct pick right after clears it. |
| `c4-shampoo-use` | Shampoo shows "Correct!" and the use ring; lifting into the ring uses it with a splash and the tip fades. Conditioner is then used through the face zone. |
| `c5-full-routine-learn-more` | The full routine, each badge and tip, Learn more, the "Either one" step, the finish message, the mirror details, and Start over with its coming-soon note. |
| `reach-ik-shampoo-learn-more` | A simulated arm reaches the shampoo and the Learn more button. |
| `stay-inside-rooms` | Walking through a wall or the closed bathroom door shows the warning; stepping back clears it; the tub counts as inside once the door is open. |

`Assets/Tests/RinseRepeatInteractor.ts` works around a mismatch between LEAF 2.0.2 and Spectacles Interaction Kit 0.18. LEAF's drag never moves a grabbed object with this kit version, so the helper holds the grab and moves the simulated pointer itself.

## How it was built

Planned with the Devpost Learn skill pack and built with the CLAD plugin, Lens Studio and the Lens Studio MCP, using an AI coding agent.

- `Assets/Scripts/RinseRepeatController.ts`: the whole flow, guide panel, markers and stay-inside check.
- `Tools/blender/build_props.py`: builds the bathroom props (tub, shower, toilet, vanity, mirror, towel, bottles, door, markers) and both room shells in Blender 5.2, then exports GLB files. Run it with `blender --background --factory-startup --python Tools/blender/build_props.py -- <texture_dir> <out_dir> [names...]`, where `<texture_dir>` holds the Poly Haven texture folders listed below.

## Credits and licences

- Models from [Poly Haven](https://polyhaven.com), CC0: Shelf 01, Fancy Picture Frame 01, Modern Ceiling Lamp 01, Painted Wooden Nightstand, Potted Plant 04, Rubber Duck Toy, Vintage Day Bed, Vintage Wooden Drawer 01, Wall Clock (glass transmission removed for Lens Studio).
- Textures from Poly Haven, CC0: herringbone parquet, interior tiles, long white tiles, painted plaster wall, white oak veneer, terry cloth, rough linen (the last three baked into the generated props).
- All other props and the room shells are generated by `Tools/blender/build_props.py`.
- Sound effects and the ambient music (`Assets/GeneratedSFX`, `Assets/Audio`) are synthesized algorithmically with the CLAD audio generators; no samples or recordings are used.
- Packages from Snap: Spectacles Interaction Kit, Spectacles UI Kit, LEAF, Bitmoji 3D, under their own licences.

## Known limits

- Only tested in the Lens Studio preview, not on Spectacles.
- The rooms are life-size: walking from the start to the tub is about 7 m, so on glasses it needs a large open space. Leaving the floor plan shows the stay-inside warning.
- The layout is fitted to the Specs field of view, about 32° wide and 42° tall. The shelf sits about 134 cm high and the door 200 cm away so each task stays in view; the carried towel hangs outside that view.

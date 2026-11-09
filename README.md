# Rinse & Repeat

A Lens for Snap Spectacles (SPECS) that teaches the order of a shower routine in a simulated bathroom: shampoo, then conditioner, then body wash or bar soap.

## What happens

1. **Opening.** A closed door and a towel with the sign "Don't forget your towel." Take the towel, then pinch the door handle. The door swings open and a bright light fades to reveal the bathroom.
2. **Towel.** "Put your towel on the bar." Drop the towel on the bar to your right. "Time to learn how to take a shower." shows for about 3 seconds.
3. **Lesson.** Pick up a product from the shelf.
   - The right one shows "Correct! Now use it on yourself."
   - A wrong one shows "Not yet. Put it back." with a hint, and returns to the shelf when you let go.
4. **Use.** Bring the right product up to your face. It disappears with a splash, and a tip card shows for about 5 seconds before fading. A **Learn more** button opens a short panel about that product.
5. **Finish.** After the last step: "That's the routine: shampoo, conditioner, then body wash or soap."

The bathroom is simulated. No water, avatar or camera image of the user is involved.

## Requirements

- Lens Studio 5.24.1 with the SPECS preview
- Packages (included in `Packages/`): Spectacles Interaction Kit, Spectacles UI Kit, LEAF 2.0.2, Bitmoji 3D

## Open and run

1. Open `RinseRepeat.esproj` in Lens Studio.
2. Use the Preview panel in Interactive mode. Click and drag with the mouse to grab objects.
3. On the `RinseRepeat` object, the `RinseRepeatController` component has settings for testing:
   - `startAt`: `opening`, `towel` or `lesson`, to skip ahead.
   - `eyeLevelAssist`: also counts a product as used when it is lifted to eye level. A mouse drag keeps a fixed depth, so it can't reach a zone close to the face. Turn this off to require the face zone only.
   - `tipSeconds`, `introSeconds`, `towelSnapDistance`, `faceZoneRadius`.

## Tests

The LEAF scenarios live in `Assets/Tests` and are registered in `LeafIndex.ts`.

1. Enable the `LeafIndex` object in the scene. While it is enabled, mouse input in the preview is turned off, so disable it again for manual use.
2. Run the scenarios from the LEAF panel.

| Scenario | Checks |
|---|---|
| `c1-door-opens-with-towel` | The door stays shut without the towel. With it, the door opens, the light fades and the bathroom shows. |
| `c2-towel-on-bar` | The towel on the bar shows the intro message. |
| `c3-wrong-product-first` | Conditioner, body wash and bar soap each show the "Not yet" badge and return to the shelf. |
| `c4-shampoo-use` | Shampoo shows "Correct!", then the face zone uses it with a splash, and the tip fades. |
| `c5-full-routine-learn-more` | The full routine, each badge and tip, Learn more, and the finish message. |
| `reach-ik-shampoo-learn-more` | A simulated arm reaches the shampoo and the Learn more button. |

`Assets/Tests/RinseRepeatInteractor.ts` works around a mismatch between LEAF 2.0.2 and Spectacles Interaction Kit 0.18. LEAF's drag never moves a grabbed object with this kit version, so the helper holds the grab and moves the simulated pointer itself.

## Known limits

- The `reach-ik-shampoo-learn-more` scenario fails. The simulated arm does not reach the shelf at about 70 cm.
- The layout is fitted to the Specs field of view, about 32° wide and 42° tall. The shelf sits at 135 cm and the door at 200 cm so the task stays in view.

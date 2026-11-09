import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {RinseRepeatInteractor} from "./RinseRepeatInteractor"
import {
  MSG_BODY_CHOICE,
  MSG_CORRECT,
  MSG_FINISH,
  MSG_INCORRECT,
  MSG_LEARN,
  MSG_LIFT,
} from "../Scripts/RinseRepeatController"
import {
  controller,
  dragTowelToBar,
  interactable,
  liftIntoRing,
  obj,
  pickUpAndRelease,
  textOf,
  useProduct,
  visible,
  waitFor,
  worldPos,
} from "./RinseRepeatTestUtils"

/**
 * Done criterion 4: picking up the shampoo first shows "Correct! Now use it on yourself";
 * dragging it up into the face zone makes it disappear with a splash, and its tip card
 * appears, then fades.
 */
@component
export class ShampooUseScenario extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const plays0 = {...c.sfxPlays}
    const played = (name: string) => (c.sfxPlays[name] || 0) > (plays0[name] || 0)
    const interactor = new RinseRepeatInteractor()
    c.jumpToLesson()
    // Test the 25 cm face zone itself, without the eye-level assist.
    const assist = c.eyeLevelAssist
    c.eyeLevelAssist = false
    await sleep(500)

    try {
      // Picking up the right product shows where to lift it.
      const tried = await pickUpAndRelease(interactor, "Shampoo")
      expect(tried.hintText, "the badge says to lift it into the ring").toBe(MSG_LIFT)
      expect(tried.guide, "the guide panel steps aside while the right product is held").toBe("")
      expect(tried.useTargetVisible, "a glowing ring shows where to lift it").toBe(true)
      await sleep(400)
      expect(visible("UseTarget"), "the ring hides when the bottle is put back").toBe(false)

      expect(tried.badgeVisible, "badge shows when shampoo is picked up").toBe(true)
      expect(tried.badgeText).toBe(MSG_CORRECT)

      // Lift it into the ring: it glides up to the head and counts as used.
      await liftIntoRing(interactor, "Shampoo")
      const used = await waitFor(() => c.lastUsedStep === 0, 2500)
      expect(used, "lifting the shampoo into the ring uses it").toBe(true)
      expect(played("glide"), "the glide to the head makes a whoosh").toBe(true)
      expect(visible("Shampoo"), "shampoo disappears").toBe(false)
      expect(c.splashPlays, "splash sound played").toBeGreaterThan(0)
      expect(visible("TipCard"), "tip card appears").toBe(true)
      expect(textOf("TipText").includes("scalp"), "shampoo tip text").toBe(true)
      expect(c.step, "lesson moves on to conditioner").toBe(1)

      const faded = await waitFor(() => !visible("TipCard"), c.tipSeconds * 1000 + 2500)
      expect(faded, "tip card fades after a few seconds").toBe(true)

      // Bringing a bottle to the face (the 25 cm face zone, as on Specs) works too.
      await useProduct(interactor, "Conditioner")
      expect(c.lastUsedStep, "conditioner counted as used in the face zone").toBe(1)
    } finally {
      c.eyeLevelAssist = assist
    }
  }
}

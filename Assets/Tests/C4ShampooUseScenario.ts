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
} from "../Scripts/RinseRepeatController"
import {
  controller,
  dragTowelToBar,
  interactable,
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
    const interactor = new RinseRepeatInteractor()
    c.jumpToLesson()
    // Test the 25 cm face zone itself, without the eye-level assist.
    const assist = c.eyeLevelAssist
    c.eyeLevelAssist = false
    await sleep(500)

    try {
      const held = await useProduct(interactor, "Shampoo")
      expect(held.badgeVisible, "badge shows when shampoo is picked up").toBe(true)
      expect(held.badgeText).toBe(MSG_CORRECT)

      expect(c.lastUsedStep, "shampoo counted as used in the face zone").toBe(0)
      expect(visible("Shampoo"), "shampoo disappears").toBe(false)
      expect(c.splashPlays, "splash sound played").toBeGreaterThan(0)
      expect(visible("TipCard"), "tip card appears").toBe(true)
      expect(textOf("TipText").includes("scalp"), "shampoo tip text").toBe(true)
      expect(c.step, "lesson moves on to conditioner").toBe(1)

      const faded = await waitFor(() => !visible("TipCard"), c.tipSeconds * 1000 + 2500)
      expect(faded, "tip card fades after a few seconds").toBe(true)
    } finally {
      c.eyeLevelAssist = assist
    }
  }
}

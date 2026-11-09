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
 * Done criterion 5: shampoo, then conditioner, then body wash or bar soap shows each
 * correct badge and tip in turn and ends with the finish message. Pinching "Learn more"
 * during any step opens that product's panel.
 */
@component
export class FullRoutineScenario extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new RinseRepeatInteractor()
    c.jumpToLesson()
    await sleep(500)

    const steps = [
      {name: "Shampoo", tip: "scalp", title: "1. Shampoo first"},
      {name: "Conditioner", tip: "lengths and ends", title: "2. Conditioner second"},
      {name: "BodyWash", tip: "whole body", title: "3. Body wash or bar soap last"},
    ]

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      const held = await useProduct(interactor, s.name)
      expect(held.badgeText, `${s.name}: correct badge`).toBe(MSG_CORRECT)
      if (i === 2) {
        expect(held.hintText, "step 3 adds the body wash / bar soap line").toBe(MSG_BODY_CHOICE)
      }
      expect(c.lastUsedStep, `${s.name}: used`).toBe(i)
      expect(visible("TipCard"), `${s.name}: tip card shows`).toBe(true)
      expect(textOf("TipText").includes(s.tip), `${s.name}: its own tip`).toBe(true)

      // Learn more opens that product's panel, and pinching again closes it.
      expect(visible("LearnMoreButton"), `${s.name}: Learn more button shows`).toBe(true)
      await interactor.trigger(interactable("LearnMoreButton"))
      await sleep(300)
      expect(visible("LearnMorePanel"), `${s.name}: panel opens`).toBe(true)
      expect(textOf("LearnMoreTitle"), `${s.name}: panel is for this product`).toBe(s.title)
      await interactor.trigger(interactable("LearnMoreButton"))
      await sleep(300)
      expect(visible("LearnMorePanel"), `${s.name}: panel closes`).toBe(false)
    }

    const finished = await waitFor(() => visible("FinishText"), c.tipSeconds * 1000 + 3000)
    expect(finished, "finish message shows").toBe(true)
    expect(textOf("FinishText")).toBe(MSG_FINISH)
    expect(c.stage).toBe("finished")
    expect(obj("BarSoap").enabled, "unused bar soap stays on the shelf").toBe(true)
  }
}

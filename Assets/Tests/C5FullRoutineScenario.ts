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
  MSG_LIFT_BODY,
  MSG_MIRROR,
  MSG_NEXT_BODY,
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
    const plays0 = {...c.sfxPlays}
    const played = (name: string) => (c.sfxPlays[name] || 0) > (plays0[name] || 0)
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
      if (i === 2) {
        expect(visible("EitherLabel"), "step 3 says either one works").toBe(true)
        const asked = await waitFor(() => c.guideShowing === MSG_NEXT_BODY, c.tipSeconds * 1000 + 2500)
        expect(asked, "guide says body wash or bar soap, either one").toBe(true)
      }
      const held = await useProduct(interactor, s.name)
      expect(held.badgeText, `${s.name}: correct badge`).toBe(MSG_CORRECT)
      if (i === 2) {
        expect(held.hintText.startsWith(MSG_BODY_CHOICE), "step 3 adds the body wash / bar soap line").toBe(true)
        expect(held.hintText.endsWith(MSG_LIFT_BODY), "step 3 says to wash with it, not to put it on your hair").toBe(true)
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
    expect(played("finish"), "finishing plays a chime").toBe(true)
    expect(c.stage).toBe("finished")
    expect(obj("BarSoap").enabled, "unused bar soap stays on the shelf").toBe(true)
    expect(visible("LearnMoreButton"), "Learn more leaves the shelf when the routine is done").toBe(false)

    // Then the guide sends the user to the mirror: read about any product again, or start over.
    const atMirror = await waitFor(() => visible("MirrorMenu") && c.guideShowing === MSG_MIRROR, 7000)
    expect(atMirror, "mirror menu appears and the guide points to it").toBe(true)
    // The menu's buttons finish setting up a frame or two after the menu turns on.
    await sleep(600)
    await interactor.trigger(interactable("MirrorConditioner"))
    const read = await waitFor(() => visible("MirrorInfo") && textOf("MirrorInfo").startsWith("2. Conditioner"), 1500)
    expect(read, "the mirror shows the conditioner details").toBe(true)
    expect(played("ui_click"), "buttons click").toBe(true)
    expect(c.comingSoon.enabled, "no coming-soon note before starting over").toBe(false)
    await interactor.trigger(interactable("MirrorRestart"))
    const restarted = await waitFor(() => c.stage === "opening" && visible("TowelSign"), 1500)
    expect(restarted, "Start over goes back to the beginning").toBe(true)
    expect(visible("MirrorMenu"), "mirror menu hides after starting over").toBe(false)
    expect(c.comingSoon.enabled, "Start over shows the coming-soon note under the towel sign").toBe(true)
  }
}

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
  MSG_FIRST,
  MSG_HANG_TOWEL,
  MSG_STEP_IN,
} from "../Scripts/RinseRepeatController"
import {
  controller,
  dragTowelToBar,
  standAt,
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
 * Done criterion 2: hanging the towel on the bar shows "Time to learn how to take a shower."
 * Two ways: pinch the towel bar (the towel goes over it), or drop the towel on the bar.
 */
@component
export class TowelOnBarScenario extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new RinseRepeatInteractor()
    c.jumpToTowelToBar()
    await sleep(500)

    expect(visible("PutTowelText"), "towel prompt shows in the bathroom").toBe(true)
    expect(visible("BarMarker"), "an arrow points at the towel bar").toBe(true)
    expect(c.guideShowing, "guide says to hang the towel").toBe(MSG_HANG_TOWEL)
    expect(visible("LessonText"), "lesson message is not shown yet").toBe(false)

    // 1. Pinch the bar: the carried towel goes over it. The bar itself does not change size.
    const barScale = obj("TowelBar").getTransform().getLocalScale()
    await interactor.trigger(interactable("TowelBar"))
    expect(obj("TowelBar").getTransform().getLocalScale().distance(barScale) < 0.001, "bar keeps its size").toBe(true)
    const hung = await waitFor(() => c.towelOnBar, 2000)
    expect(hung, "pinching the bar hangs the towel").toBe(true)
    expect(visible("TowelDraped"), "towel drapes over the bar").toBe(true)
    expect(visible("LessonText"), "lesson message shows").toBe(true)

    // 2. Drop it on the bar instead.
    c.jumpToTowelToBar()
    await sleep(500)
    await dragTowelToBar(interactor)

    expect(c.towelOnBar, "dropping the towel on the bar hangs it").toBe(true)
    expect(visible("PutTowelText"), "towel prompt hides").toBe(false)
    expect(visible("LessonText"), "lesson message shows").toBe(true)
    expect(textOf("LessonText")).toBe(MSG_LEARN)

    // It fades after about 3 seconds; the guide asks the user to step into the tub.
    const faded = await waitFor(() => !visible("LessonText"), 5000)
    expect(faded, "lesson message fades").toBe(true)
    expect(c.stage).toBe("toTub")
    const askedIn = await waitFor(() => c.guideShowing === MSG_STEP_IN, 1000)
    expect(askedIn, "guide says to step into the bathtub").toBe(true)

    // Stepping into the tub starts the lesson.
    standAt("LessonSpot")
    const started = await waitFor(() => c.stage === "lesson", 1000)
    expect(started, "the lesson starts in the tub").toBe(true)
    const asked = await waitFor(() => c.guideShowing === MSG_FIRST, 1000)
    expect(asked, "guide asks what to use first").toBe(true)
  }
}

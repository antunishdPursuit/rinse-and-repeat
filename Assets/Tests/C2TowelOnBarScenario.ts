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
 * Done criterion 2: dropping the towel on the towel bar shows
 * "Time to learn how to take a shower."
 */
@component
export class TowelOnBarScenario extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new RinseRepeatInteractor()
    c.jumpToTowelToBar()
    await sleep(500)

    expect(visible("PutTowelText"), "towel prompt shows in the bathroom").toBe(true)
    expect(visible("LessonText"), "lesson message is not shown yet").toBe(false)

    await dragTowelToBar(interactor)

    expect(c.towelOnBar, "towel snaps onto the bar").toBe(true)
    expect(visible("PutTowelText"), "towel prompt hides").toBe(false)
    expect(visible("LessonText"), "lesson message shows").toBe(true)
    expect(textOf("LessonText")).toBe(MSG_LEARN)

    // It fades after about 3 seconds and the lesson begins.
    const faded = await waitFor(() => !visible("LessonText"), 5000)
    expect(faded, "lesson message fades").toBe(true)
    expect(c.stage).toBe("lesson")
  }
}

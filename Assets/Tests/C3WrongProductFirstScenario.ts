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
 * Done criterion 3: picking up any product other than shampoo first shows the incorrect
 * badge with "Not yet. Put it back," and releasing it returns it to the shelf.
 */
@component
export class WrongProductFirstScenario extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new RinseRepeatInteractor()
    c.jumpToLesson()
    await sleep(500)

    for (const name of ["Conditioner", "BodyWash", "BarSoap"]) {
      const home = worldPos(name)
      const held = await pickUpAndRelease(interactor, name)
      expect(held.badgeVisible, `${name}: badge shows while held`).toBe(true)
      expect(held.badgeText, `${name}: incorrect badge`).toBe(MSG_INCORRECT)
      expect(held.hintVisible && held.hintText.length > 0, `${name}: one-line hint shows`).toBe(true)

      expect(held.guide.startsWith(MSG_INCORRECT), `${name}: guide panel says not yet`).toBe(true)

      await sleep(600)
      expect(visible("Badge"), `${name}: badge hides on release`).toBe(false)
      expect(c.guideShowing.startsWith(MSG_INCORRECT), `${name}: the guide feedback stays after letting go`).toBe(true)
      expect(worldPos(name).distance(home) < 1.0, `${name}: returns to its spot on the shelf`).toBe(true)
      expect(visible(name), `${name}: still on the shelf`).toBe(true)
    }
    // Picking the right one straight after a wrong one must not keep showing "Not yet".
    await pickUpAndRelease(interactor, "Conditioner")
    const right = await pickUpAndRelease(interactor, "Shampoo")
    expect(right.guide.startsWith(MSG_INCORRECT), "no leftover 'Not yet' while holding the shampoo").toBe(false)
    expect(right.badgeText, "badge says correct").toBe(MSG_CORRECT)

    expect(c.step, "lesson still waiting for shampoo").toBe(0)
  }
}

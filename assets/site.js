"use strict";
const choices = document.querySelector("#choices");
const response = document.querySelector("#response");
const reset = document.querySelector("#reset");
function showAnswer(correct) {
  choices.hidden = true;
  response.replaceChildren();
  const quote = document.createElement("blockquote");
  quote.className = "learner";
  quote.textContent = correct ? "No—their speeds match, but their directions differ." : "Yes—both are travelling at 5 m/s.";
  const feedback = document.createElement("div");
  feedback.className = "feedback";
  const heading = document.createElement("h4");
  heading.textContent = correct ? "Exactly. Direction is the distinction." : "Not quite. You compared their speeds.";
  const explanation = document.createElement("p");
  explanation.textContent = correct ? "You separated the magnitude from the direction. Their speeds are equal, but their velocities point in opposite directions. Next we can ask what happens when a direction changes." : "The 5 m/s tells us how fast each cyclist moves. Velocity also includes direction, so opposite directions mean different velocities. Let’s check that distinction with a smaller question.";
  feedback.append(heading, explanation);
  if (!correct) {
    const followup = document.createElement("p");
    followup.textContent = "A cyclist turns around without changing speed. Has their velocity changed?";
    feedback.append(followup);
  }
  response.append(quote, feedback);
  reset.hidden = false;
}
choices.addEventListener("click", event => {
  const button = event.target.closest("button[data-answer]");
  if (button) showAnswer(button.dataset.answer === "correct");
});
reset.addEventListener("click", () => {
  response.replaceChildren();
  choices.hidden = false;
  reset.hidden = true;
  choices.querySelector("button").focus();
});

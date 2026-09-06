"use client";

import { useState } from "react";
import { QuizQuestionCard } from "@/components/quiz/QuizQuestionCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getSortedQuestionOptions } from "@/features/learning/admin/assessment-builder-domain";
import type { AdminQuizQuestionRow } from "@/features/learning/admin/data";

// This component is only mounted by the authorized admin preview route. Answers
// stay in memory: no attempts, progress, XP or learner APIs are involved.
export function LessonQuizPreview({ questions }: { questions: AdminQuizQuestionRow[] }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [finished, setFinished] = useState(false);
  const question = questions[index];

  if (!question) return null;
  if (finished) {
    return (
      <Card className="space-y-4 p-6">
        <h2 className="text-xl font-black">Quiz preview complete</h2>
        <p className="text-sm text-[var(--ve-muted-strong)]">You have reached the end of the lesson and quiz. No progress or XP was recorded.</p>
        <Button onClick={() => { setIndex(0); setSelected([]); setChecked(false); setFinished(false); }} type="button">Restart quiz preview</Button>
      </Card>
    );
  }

  const options = getSortedQuestionOptions(question);
  const correctOptions = options.filter((option) => option.is_correct);
  const correct = selected.length === correctOptions.length && correctOptions.every((option) => selected.includes(option.id));

  return (
    <div className="space-y-5">
      <QuizQuestionCard
        badge="Preview"
        current={{
          prompt: question.prompt,
          type: question.question_type === "multiple_choice" ? "multiple_choice" : question.question_type === "true_false" ? "true_false" : "single_choice",
          options: options.map((option) => ({ id: option.id, questionId: question.id, label: option.label, order: option.option_order })),
        }}
        onSelectOption={(id) => {
          setChecked(false);
          setSelected((previous) => question.question_type === "multiple_choice"
            ? previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]
            : [id]);
        }}
        questionNumber={index + 1}
        selectedOptionIds={selected}
        totalQuestions={questions.length}
      />
      {checked ? (
        <Card className="space-y-2 p-5" role="status">
          <p className="font-bold">{correct ? "Correct" : "Not quite"}</p>
          <p className="text-sm">Correct answer: {correctOptions.map((option) => option.label).join(", ")}</p>
          {question.explanation ? <p className="text-sm text-[var(--ve-muted-strong)]">{question.explanation}</p> : null}
        </Card>
      ) : null}
      <div className="flex justify-end">
        {checked ? (
          <Button onClick={() => {
            if (index === questions.length - 1) setFinished(true);
            else { setIndex(index + 1); setSelected([]); setChecked(false); }
          }} type="button">{index === questions.length - 1 ? "Finish preview" : "Next question"}</Button>
        ) : (
          <Button disabled={selected.length === 0} onClick={() => setChecked(true)} type="button">Check answer</Button>
        )}
      </div>
    </div>
  );
}

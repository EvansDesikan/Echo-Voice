"""QA Engineer — Unit tests for questionnaire scoring and personality rendering."""
import pytest
from src.questionnaire.scorer import score_dimension, compute_ocean_scores, derive_behavioral_tags, process_questionnaire
from src.questionnaire.questions import QUESTIONNAIRE, QUESTION_MAP
from src.agent.personality import render_system_prompt


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def high_extravert_answers():
    """Answers that should score high on E and low on N."""
    answers = {}
    for q in QUESTIONNAIRE:
        if q.dimension == "E":
            answers[q.id] = 1 if q.reversed else 5
        elif q.dimension == "N":
            answers[q.id] = 5 if q.reversed else 1
        else:
            answers[q.id] = 3  # neutral on everything else
    # Behavioural and communication
    for q in QUESTIONNAIRE:
        if q.dimension in ("BEH", "COMM") and q.id not in answers:
            answers[q.id] = 3
    return answers


@pytest.fixture
def all_neutral_answers():
    return {q.id: 3 for q in QUESTIONNAIRE}


# ─── Scoring tests ────────────────────────────────────────────────────────────

def test_score_dimension_returns_0_to_1(all_neutral_answers):
    for dim in ["O", "C", "E", "A", "N"]:
        score = score_dimension(all_neutral_answers, dim)
        assert 0.0 <= score <= 1.0, f"Score for {dim} out of range: {score}"


def test_neutral_answers_give_midpoint(all_neutral_answers):
    for dim in ["O", "C", "E", "A", "N"]:
        score = score_dimension(all_neutral_answers, dim)
        assert abs(score - 0.5) < 0.01, f"Expected ~0.5 for {dim}, got {score}"


def test_high_extravert_scores_high_e(high_extravert_answers):
    score = score_dimension(high_extravert_answers, "E")
    assert score >= 0.9, f"Expected E >= 0.9, got {score}"


def test_high_extravert_scores_low_n(high_extravert_answers):
    score = score_dimension(high_extravert_answers, "N")
    assert score <= 0.15, f"Expected N <= 0.15, got {score}"


def test_compute_ocean_returns_all_dimensions(all_neutral_answers):
    ocean = compute_ocean_scores(all_neutral_answers)
    assert set(ocean.keys()) == {"O", "C", "E", "A", "N"}


def test_reversed_scoring():
    """A reversed question answered 5 should contribute a low score."""
    reversed_q = next(q for q in QUESTIONNAIRE if q.reversed and q.dimension == "E")
    answers = {q.id: 3 for q in QUESTIONNAIRE}
    answers[reversed_q.id] = 5  # maximum on a reversed item = minimum contribution
    score_with_5 = score_dimension(answers, "E")
    answers[reversed_q.id] = 1  # minimum on a reversed item = maximum contribution
    score_with_1 = score_dimension(answers, "E")
    assert score_with_5 < score_with_1, "Reversed scoring failed"


# ─── Behavioural tag tests ────────────────────────────────────────────────────

def test_humour_tag_assigned_when_beh1_high(all_neutral_answers):
    answers = dict(all_neutral_answers)
    answers["BEH1"] = 5
    ocean = compute_ocean_scores(answers)
    tags = derive_behavioral_tags(answers, ocean)
    assert "uses_humour_often" in tags


def test_no_humour_tag_when_beh1_low(all_neutral_answers):
    answers = dict(all_neutral_answers)
    answers["BEH1"] = 1
    ocean = compute_ocean_scores(answers)
    tags = derive_behavioral_tags(answers, ocean)
    assert "rarely_jokes" in tags
    assert "uses_humour_often" not in tags


def test_direct_tag_assigned(all_neutral_answers):
    answers = dict(all_neutral_answers)
    answers["BEH3"] = 5
    ocean = compute_ocean_scores(answers)
    tags = derive_behavioral_tags(answers, ocean)
    assert "very_direct_no_fluff" in tags


# ─── Personality prompt tests ─────────────────────────────────────────────────

def test_render_system_prompt_contains_client_name():
    ocean = {"O": 0.7, "C": 0.6, "E": 0.8, "A": 0.7, "N": 0.3}
    tags = ["uses_humour_often", "very_direct_no_fluff"]
    phrases = ["Na, wie läuft's?", "Das schaffen wir schon."]
    prompt = render_system_prompt("Maria Müller", ocean, tags, phrases, "de")
    assert "Maria Müller" in prompt


def test_render_system_prompt_contains_phrases():
    ocean = {"O": 0.5, "C": 0.5, "E": 0.5, "A": 0.5, "N": 0.5}
    phrases = ["Alles wird gut", "Bis später, Schatz"]
    prompt = render_system_prompt("Test Person", ocean, [], phrases, "de")
    assert "Alles wird gut" in prompt
    assert "Bis später, Schatz" in prompt


def test_render_system_prompt_language_de():
    ocean = {"O": 0.5, "C": 0.5, "E": 0.5, "A": 0.5, "N": 0.5}
    prompt = render_system_prompt("Test", ocean, [], [], "de")
    assert "German" in prompt or "Deutsch" in prompt or "Du-form" in prompt


def test_full_pipeline_smoke(all_neutral_answers):
    """End-to-end: answers → OCEAN → tags → prompt — no errors."""
    result = process_questionnaire(all_neutral_answers)
    assert "ocean_scores" in result
    assert "behavioral_tags" in result
    prompt = render_system_prompt(
        "Demo Person",
        result["ocean_scores"],
        result["behavioral_tags"],
        ["Guten Morgen!"],
        "de",
    )
    assert len(prompt) > 200  # substantive prompt produced


# ─── Question bank integrity ──────────────────────────────────────────────────

def test_all_question_ids_unique():
    ids = [q.id for q in QUESTIONNAIRE]
    assert len(ids) == len(set(ids)), "Duplicate question IDs found"


def test_all_questions_have_both_languages():
    for q in QUESTIONNAIRE:
        assert q.text_de, f"Missing German text for {q.id}"
        assert q.text_en, f"Missing English text for {q.id}"


def test_ocean_dimensions_covered():
    dims = {q.dimension for q in QUESTIONNAIRE}
    assert {"O", "C", "E", "A", "N"}.issubset(dims)

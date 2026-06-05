"""
AI/ML Engineer — Personality Scorer
Maps raw questionnaire answers (question_id → 1-5) to OCEAN scores (0.0–1.0)
and derives behavioural tags used to construct the LLM system prompt.
"""
from typing import Dict, List

from src.questionnaire.questions import QUESTION_MAP, get_questions_by_dimension


DIMENSIONS = ["O", "C", "E", "A", "N"]


def score_dimension(answers: Dict[str, int], dimension: str) -> float:
    """
    Returns a normalised score 0.0–1.0 for one OCEAN dimension.
    Reversed items are flipped (5 → 1, 4 → 2, etc.) before averaging.
    """
    questions = get_questions_by_dimension(dimension)
    total, count = 0, 0
    for q in questions:
        raw = answers.get(q.id)
        if raw is None:
            continue
        score = (6 - raw) if q.reversed else raw
        total += score
        count += 1
    if count == 0:
        return 0.5  # neutral default if no answers
    return (total / count - 1) / 4.0  # maps [1,5] → [0.0, 1.0]


def compute_ocean_scores(answers: Dict[str, int]) -> Dict[str, float]:
    return {dim: score_dimension(answers, dim) for dim in DIMENSIONS}


def derive_behavioral_tags(answers: Dict[str, int], ocean: Dict[str, float]) -> List[str]:
    """
    Produces a list of behavioural string tags that get injected into the
    personality system prompt. These shape HOW the agent speaks, not just WHAT.
    """
    tags = []

    # Humour
    beh1 = answers.get("BEH1", 3)
    if beh1 >= 4:
        tags.append("uses_humour_often")
    elif beh1 <= 2:
        tags.append("rarely_jokes")

    # Storytelling
    if answers.get("BEH2", 3) >= 4:
        tags.append("uses_stories_and_examples")

    # Directness
    beh3 = answers.get("BEH3", 3)
    if beh3 >= 4:
        tags.append("very_direct_no_fluff")
    elif beh3 <= 2:
        tags.append("diplomatic_roundabout")

    # Voice energy
    if answers.get("BEH4", 3) >= 4:
        tags.append("measured_quiet_speaker")
    else:
        tags.append("animated_expressive_speaker")

    # Support style
    if answers.get("BEH5", 3) >= 4:
        tags.append("solution_focused_in_hard_talks")
    else:
        tags.append("empathy_first_in_hard_talks")

    # Family vs formal
    if answers.get("COMM1", 3) >= 4:
        tags.append("warmer_with_family_than_colleagues")

    # Affection via action
    if answers.get("COMM2", 3) >= 4:
        tags.append("shows_love_through_actions")
    else:
        tags.append("verbally_affectionate")

    # Nicknames
    if answers.get("COMM3", 3) >= 4:
        tags.append("uses_nicknames_and_pet_names")

    # Comfortable with silence
    if answers.get("COMM5", 3) >= 4:
        tags.append("comfortable_with_silence")

    # OCEAN-derived macro tags
    if ocean["E"] >= 0.7:
        tags.append("naturally_chatty_and_engaging")
    elif ocean["E"] <= 0.3:
        tags.append("thoughtful_and_reserved")

    if ocean["A"] >= 0.7:
        tags.append("warm_and_caring_tone")
    elif ocean["A"] <= 0.3:
        tags.append("blunt_and_no_nonsense")

    if ocean["O"] >= 0.7:
        tags.append("loves_exploring_ideas_in_conversation")

    if ocean["N"] >= 0.7:
        tags.append("expresses_vulnerability_and_worry")
    elif ocean["N"] <= 0.2:
        tags.append("stoic_and_steady")

    if ocean["C"] >= 0.7:
        tags.append("structured_and_purposeful_responses")

    return tags


def process_questionnaire(answers: Dict[str, int]) -> Dict:
    """
    Full pipeline: raw answers → OCEAN scores + behavioural tags.
    Returns a dict ready to store in PostgreSQL and pass to the personality engine.
    """
    ocean = compute_ocean_scores(answers)
    tags = derive_behavioral_tags(answers, ocean)
    return {
        "ocean_scores": ocean,
        "behavioral_tags": tags,
    }

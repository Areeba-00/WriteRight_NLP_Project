from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from spellchecker import SpellChecker
import re
from typing import List
from collections import Counter
import math

app = FastAPI(title="Word Editor API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

spell = SpellChecker()

SKIP_WORDS = {
    "i","a","s","ok","mr","mrs","dr","vs","etc",
    "jan","feb","mar","apr","jun","jul","aug","sep","oct","nov","dec",
    "id","tv","pc","ai","ml","nlp","api","url","ui","ux",
}

class CheckRequest(BaseModel):
    text: str

class ErrorItem(BaseModel):
    start: int
    end: int
    type: str
    word: str
    message: str
    suggestions: List[str]

CONTEXTUAL_PATTERNS = [
    # aloud vs allowed
    (r"\b(not|never|is|are|was|were|be|been|being)\s+aloud\b",
     "'Aloud' means speaking out loud. Did you mean 'allowed' (permitted)?", ["allowed"]),
    (r"\baloud\s+to\b",
     "'Aloud' means to speak out loud. Did you mean 'allowed to'?", ["allowed to"]),
    # quiet vs quite
    (r"\bquiet\s+(good|bad|well|nice|big|small|large|long|short|fast|slow|easy|hard|clear|sure|right|wrong|interesting|amazing|important|different|similar|common|popular|useful|helpful|difficult|simple|obvious|far|close|heavy|light|strong|weak|early|late|young|old)\b",
     "Did you mean 'quite' (fairly/very) instead of 'quiet' (silent)?", ["quite"]),
    # accept vs except
    (r"\bexcept\s+(this|that|it|the offer|my apology|apologies|responsibility|blame|credit|the gift|the award|the prize)\b",
     "Did you mean 'accept' (to receive/agree) instead of 'except' (to exclude)?", ["accept"]),
    # advice vs advise
    (r"\b(please|can you|could you|i|he|she|they|we|would|will)\s+advice\s+(you|him|her|them|us|me)\b",
     "As a verb, use 'advise' not 'advice'. 'Advice' is the noun.", ["advise"]),
    # desert vs dessert
    (r"\b(ate|eat|eating|had|have|want|wanted|order|ordered|served|serving|love|loved|enjoy|enjoyed)\s+desert\b",
     "The sweet food after a meal is 'dessert' (two s's). 'Desert' is a dry landscape.", ["dessert"]),
    # weather vs whether
    (r"\bweather\s+(or not|you like|i like|he likes|she likes|they like|we like|it works|it is|that is|this is)\b",
     "Use 'whether' (if/or not) not 'weather' (climate)", ["whether"]),
    # than vs then (comparison)
    (r"\b(more|less|better|worse|higher|lower|faster|slower|bigger|smaller|greater|fewer|rather|other)\s+then\b",
     "Use 'than' for comparisons (e.g. 'better than'), not 'then' (which shows time)", ["than"]),
    # your vs you're
    (r"\byour\s+(welcome|right|wrong|sure|fault|kidding|joking|correct|late|early|done|going|coming|lying|mistaken|amazing|great|awesome)\b",
     "Likely 'you're' (you are) instead of 'your' (possession)", ["you're"]),
    # its vs it's
    (r"\bits\s+(a|an|the|not|been|just|only|also|very|quite|really|almost|still|already|never|always|often|sometimes|going|getting|coming|working|running|important|necessary|clear|obvious|true|false|good|bad)\b",
     "Likely 'it's' (it is/has) instead of 'its' (possession)", ["it's"]),
    # there vs their
    (r"\bthere\s+(car|house|home|dog|cat|book|bag|phone|team|family|friend|teacher|school|job|room|office|work|money|time|life|story|idea|plan|fault|problem|mistake|choice|son|daughter|mother|father|parents|children|kids|sister|brother|class|project|assignment|homework|report|essay|clothes|shoes|food|laptop|computer|bike)\b",
     "Likely 'their' (possession) instead of 'there' (location)", ["their"]),
    # should/could/would of
    (r"\b(should|could|would|must|might|may)\s+of\b",
     "Use 'have' not 'of' after modal verbs (e.g. 'should have', 'could have')",
     ["should have", "could have", "would have"]),
    # a vs an before vowel
    (r"\ba\s+(?=[aeiouAEIOU])\b",
     "Use 'an' before vowel sounds (e.g. 'an apple', 'an hour', 'an idea')", ["an"]),
    # irregardless
    (r"\birregardless\b", "'Irregardless' is non-standard. Use 'regardless'", ["regardless"]),
    # alot
    (r"\balot\b", "'Alot' is not a word. Use 'a lot'", ["a lot"]),
    # could care less
    (r"\bcould\s+care\s+less\b",
     "You probably mean 'couldn't care less' (meaning you care zero)", ["couldn't care less"]),
    # loose vs lose
    (r"\b(will|would|could|should|might|may|don't|doesn't|didn't|not|never)\s+loose\b",
     "Use 'lose' (to be defeated/misplace) not 'loose' (not tight)", ["lose"]),
    # affect vs effect
    (r"\b(will|can|may|might|could|would|does|did|to|not)\s+effect\s+(the|a|an|this|that|your|our|their|his|her)\b",
     "Likely 'affect' (verb: to influence) instead of 'effect' (noun: result)", ["affect"]),
    # they're vs their
    (r"\bthey're\s+(car|house|home|dog|cat|book|bag|phone|team|family|friend|teacher|school|job|room|office|work|money|time|life|story|idea|plan|fault|problem|mistake|choice)\b",
     "Likely 'their' (possession) instead of 'they're' (they are)", ["their"]),
    # you're vs your possessive
    (r"\byou're\s+(book|car|house|home|phone|bag|dog|cat|name|job|team|family|friend|room|money|time|idea|plan|fault|problem|mistake|choice|turn|life|work|office|school|teacher|class|project|assignment|homework|report|essay|clothes|shoes|food|laptop|computer|bike)\b",
     "Likely 'your' (possession) instead of 'you're' (you are)", ["your"]),
]

GRAMMAR_PATTERNS = [
    # Repeated words
    (r"\b([a-zA-Z]+)\s+\1\b", "Repeated word", []),
    # he/she/it + bare verb
    (r"\b(he|she|it)\s+(go|have|do|make|take|come|get|give|know|think|see|look|want|use|find|tell|ask|seem|feel|try|leave|call|keep|let|begin|show|hear|play|run|move|live|believe|hold|bring|happen|write|provide|stand|lose|pay|meet|include|continue|set|learn|change|lead|understand|watch|follow|stop|create|speak|read|spend|grow|open|walk|win|offer|remember|love|consider|appear|buy|wait|serve|die|send|expect|build|stay|fall|cut|reach|decide|raise|pass|sell|require|report|explain|hope|develop|carry|break|receive|agree|support|hit|produce|eat|cover|catch|draw|choose|cause|need|allow|add|share|start|push|pull|turn|reduce|check|describe|work|talk|sit|sleep|study|help|join|visit|say|ask|answer|return|become|remain|contain|suggest|indicate|reveal|apply|form|define|establish|identify|represent|enable|prevent|ensure|achieve|maintain|obtain|consider|increase|improve|affect|select|complete|perform|compare|control|manage|prepare|respond|refer|relate)\b",
     "Subject-verb disagreement: use '{word}s' with he/she/it", []),
    # I/we/they/you + is
    (r"\b(i|we|they|you)\s+(is)\b",
     "Subject-verb disagreement: use 'am' (for I) or 'are' (for we/they/you)", ["am", "are"]),
    # we/they/you + was
    (r"\b(we|they|you)\s+(was)\b", "Use 'were' instead of 'was' with we/they/you", ["were"]),
    # they/we/you + has
    (r"\b(they|we|you)\s+(has)\b", "Use 'have' instead of 'has' with we/they/you", ["have"]),
    # it's used as possessive
    (r"\bit's\s+(own|self|color|colour|size|shape|name|value|place|position|role|function|purpose|nature|form|structure)\b",
     "Likely 'its' (possession) instead of 'it's' (it is)", ["its"]),
    # double negatives
    (r"\b(don't|doesn't|didn't|can't|won't|isn't|aren't|wasn't|weren't|never)\s+\w+\s+(nothing|nobody|nowhere|neither|never|no\s+one)\b",
     "Double negative detected — use a positive form instead", []),
]


def get_suggestions(word: str, n: int = 3) -> List[str]:
    candidates = spell.candidates(word.lower()) or set()
    wf = spell.word_frequency
    return sorted(candidates, key=lambda w: wf[w], reverse=True)[:n]


def check_spelling(text: str) -> List[ErrorItem]:
    errors = []
    for match in re.finditer(r"\b[a-zA-Z']{2,}\b", text):
        word = match.group()
        word_lower = word.lower().strip("'")
        if word_lower in SKIP_WORDS:
            continue
        if word.isupper() and len(word) > 1:
            continue
        if word_lower not in spell:
            correction = spell.correction(word_lower)
            if correction and correction != word_lower:
                errors.append(ErrorItem(
                    start=match.start(), end=match.end(),
                    type="spelling", word=word,
                    message=f"Spelling error. Did you mean '{correction}'?",
                    suggestions=get_suggestions(word_lower),
                ))
    return errors


def check_grammar(text: str) -> List[ErrorItem]:
    errors = []
    text_lower = text.lower()
    for pattern, message, suggestions in GRAMMAR_PATTERNS:
        for match in re.finditer(pattern, text_lower):
            if "Repeated" in message:
                word = match.group(1)
                msg = f"Repeated word: '{word}' — remove one"
                sugg = [word]
            elif "he/she/it" in message:
                verb = match.group(2)
                irreg = {"go":"goes","do":"does","have":"has","make":"makes","take":"takes",
                         "come":"comes","give":"gives","know":"knows","say":"says",
                         "try":"tries","carry":"carries","study":"studies","fly":"flies","apply":"applies"}
                if verb in irreg:
                    conj = irreg[verb]
                elif verb.endswith(('ch','sh','x','s','z','o')):
                    conj = verb + "es"
                else:
                    conj = verb + "s"
                msg = f"Subject-verb disagreement: use '{conj}' with he/she/it"
                sugg = [conj]
            else:
                msg = message
                sugg = suggestions
            errors.append(ErrorItem(
                start=match.start(), end=match.end(),
                type="grammar", word=match.group(),
                message=msg, suggestions=sugg,
            ))
    return errors


def check_contextual(text: str) -> List[ErrorItem]:
    errors = []
    text_lower = text.lower()
    for pattern, message, suggestions in CONTEXTUAL_PATTERNS:
        if not pattern or not message:
            continue
        for match in re.finditer(pattern, text_lower, re.IGNORECASE):
            errors.append(ErrorItem(
                start=match.start(), end=match.end(),
                type="contextual", word=match.group(),
                message=message, suggestions=suggestions,
            ))
    return errors


def remove_overlaps(errors: List[ErrorItem]) -> List[ErrorItem]:
    priority = {"grammar": 0, "spelling": 1, "contextual": 2}
    sorted_errors = sorted(errors, key=lambda e: (e.start, priority[e.type]))
    result = []
    last_end = -1
    for e in sorted_errors:
        if e.start >= last_end:
            result.append(e)
            last_end = e.end
    return result


@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/check", response_model=List[ErrorItem])
def check_text(req: CheckRequest):
    if not req.text.strip():
        return []
    return remove_overlaps(check_spelling(req.text) + check_grammar(req.text) + check_contextual(req.text))

# ═══════════════════════════════════════════
#  LAB 5: LANGUAGE MODELS ENDPOINTS
# ═══════════════════════════════════════════

class NgramRequest(BaseModel):
    text: str
    n: int

@app.post("/ngram")
def analyze_ngram(req: NgramRequest):
    # Tokenize: lowercase and extract words
    tokens = re.findall(r'\b\w+\b', req.text.lower())
    
    total_tokens = len(tokens)
    vocab_size = len(set(tokens))
    
    if total_tokens == 0:
        return {
            "total_tokens": 0, "vocab_size": 0,
            "bigrams": {}, "trigrams": {},
            "top_unigrams": [], "top_bigrams": [], "top_trigrams": []
        }
    
    unigrams = tokens
    bigrams = [" ".join(tokens[i:i+2]) for i in range(len(tokens)-1)]
    trigrams = [" ".join(tokens[i:i+3]) for i in range(len(tokens)-2)]
    
    uni_counts = Counter(unigrams)
    bi_counts = Counter(bigrams)
    tri_counts = Counter(trigrams)
    
    def format_top(counts, limit=20):
        return [{"ngram": k, "count": v} for k, v in counts.most_common(limit)]
        
    return {
        "total_tokens": total_tokens,
        "vocab_size": vocab_size,
        "bigrams": dict(bi_counts),
        "trigrams": dict(tri_counts),
        "top_unigrams": format_top(uni_counts),
        "top_bigrams": format_top(bi_counts),
        "top_trigrams": format_top(tri_counts)
    }


class PerplexityRequest(BaseModel):
    text: str
    test_sentence: str

@app.post("/perplexity")
def calc_perplexity(req: PerplexityRequest):
    train_tokens = re.findall(r'\b\w+\b', req.text.lower())
    test_tokens = re.findall(r'\b\w+\b', req.test_sentence.lower())

    V = len(set(train_tokens))
    N = len(train_tokens)

    if N == 0 or len(test_tokens) == 0:
        return {
            "model_tokens": N, "vocab_size": V,
            "sentence_prob_mle": 0, "log_prob_mle": -999,
            "perplexity_mle": -1, "perplexity_laplace": -1, "perplexity_backoff": -1
        }

    uni_counts = Counter(train_tokens)
    bi_counts = Counter([" ".join(train_tokens[i:i+2]) for i in range(N-1)])

    prob_mle = 1.0
    log_prob_mle = 0.0
    unseen = False
    log_prob_laplace = 0.0
    log_prob_backoff = 0.0

    # Process first word
    first_word = test_tokens[0]
    p_first = uni_counts.get(first_word, 0) / N if N > 0 else 0
    if p_first == 0:
        unseen = True
    else:
        prob_mle *= p_first
        log_prob_mle += math.log2(p_first)

    p_first_lap = (uni_counts.get(first_word, 0) + 1) / (N + V)
    log_prob_laplace += math.log2(p_first_lap)

    p_first_back = p_first if p_first > 0 else 1/(N+V)
    log_prob_backoff += math.log2(p_first_back)

    # Process remaining bigrams
    for i in range(1, len(test_tokens)):
        w1 = test_tokens[i-1]
        w2 = test_tokens[i]
        bigram = f"{w1} {w2}"

        c_w1 = uni_counts.get(w1, 0)
        c_bi = bi_counts.get(bigram, 0)

        # MLE
        if c_w1 == 0 or c_bi == 0:
            unseen = True
        elif not unseen:
            p = c_bi / c_w1
            prob_mle *= p
            log_prob_mle += math.log2(p)

        # Laplace
        p_lap = (c_bi + 1) / (c_w1 + V)
        log_prob_laplace += math.log2(p_lap)

        # Backoff
        if c_bi > 0:
            p_back = c_bi / c_w1
        else:
            p_back = 0.4 * (uni_counts.get(w2, 0) / N) if N > 0 else 0
            if p_back == 0:
                p_back = 1/(N+V) 
        log_prob_backoff += math.log2(p_back)

    test_len = len(test_tokens)
    pp_mle = math.pow(2, -log_prob_mle / test_len) if not unseen else -1
    pp_lap = math.pow(2, -log_prob_laplace / test_len)
    pp_back = math.pow(2, -log_prob_backoff / test_len)

    return {
        "model_tokens": N,
        "vocab_size": V,
        "sentence_prob_mle": prob_mle if not unseen else 0,
        "log_prob_mle": log_prob_mle if not unseen else -999,
        "perplexity_mle": pp_mle,
        "perplexity_laplace": pp_lap,
        "perplexity_backoff": pp_back
    }


class CompleteRequest(BaseModel):
    text: str
    prefix: str
    n_suggestions: int = 6

@app.post("/complete")
def complete_sentence(req: CompleteRequest):
    prefix_tokens = re.findall(r'\b[a-zA-Z\']+\b', req.prefix.lower())
    
    # Spell correct the prefix
    corrected_tokens = []
    for t in prefix_tokens:
        if t in SKIP_WORDS or t in spell:
            corrected_tokens.append(t)
        else:
            corr = spell.correction(t)
            corrected_tokens.append(corr if corr else t)

    corrected_prefix = " ".join(corrected_tokens)
    train_tokens = re.findall(r'\b\w+\b', req.text.lower())
    uni_counts = Counter(train_tokens)

    if not corrected_tokens or not train_tokens:
        return {
            "corrected_prefix": req.prefix,
            "suggestions": [w for w, c in uni_counts.most_common(req.n_suggestions)],
            "bigram_used": False
        }

    last_word = corrected_tokens[-1]
    
    # Find next word frequencies based on bigrams
    next_words = [train_tokens[i+1] for i in range(len(train_tokens)-1) if train_tokens[i] == last_word]
    next_counts = Counter(next_words)

    if next_counts:
        suggestions = [w for w, c in next_counts.most_common(req.n_suggestions)]
        bigram_used = True
    else:
        # Fallback to most common words
        suggestions = [w for w, c in uni_counts.most_common(req.n_suggestions)]
        bigram_used = False

    return {
        "corrected_prefix": corrected_prefix,
        "suggestions": suggestions,
        "bigram_used": bigram_used
    }
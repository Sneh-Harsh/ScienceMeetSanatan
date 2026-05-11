from __future__ import annotations

from copy import deepcopy


CATEGORY_WORLD_LIBRARY = {
    "griha_pravesh": {
        "sanskrit_title": "Gṛha Praveśa",
        "headline": "Complete traditional process, deities worshipped, and spiritual importance",
        "hero_description": (
            "Gṛha Praveśa means entering a new house. It is a sacred domestic saṁskāra performed to purify the home, "
            "remove negative energies, invoke divine blessings, and establish harmony, prosperity, health, and spiritual protection."
        ),
        "overview": [
            "The house is treated not as a structure alone, but as a living sacred space where divine energies are invited to reside.",
            "The ceremony sanctifies the threshold, aligns the dwelling with dharmic life, and marks the beginning of a new karmic chapter for the family.",
        ],
        "types": [
            {"title": "Apoorva Gṛha Praveśa", "meaning": "Entering a newly built house for the first time."},
            {"title": "Sapoorva Gṛha Praveśa", "meaning": "Re-entering after returning from long travel or absence."},
            {"title": "Dwandwah Gṛha Praveśa", "meaning": "Entering after renovation, damage, calamity, or reconstruction."},
        ],
        "timing": {
            "auspicious_months": ["Magha", "Phalguna", "Vaishakha", "Jyeshtha"],
            "avoided_periods": ["Shraddha period", "Eclipse days", "Amavasya in many traditions", "Chaturmas in some regional traditions"],
            "nakshatras": ["Rohini", "Mrigashira", "Uttara Phalguni", "Chitra", "Anuradha", "Revati"],
            "rule": "The home should ideally have completed roofing, installed doors, finished structure, and a functioning kitchen before the ceremony.",
        },
        "spiritual_points": [
            "Awaken positive cosmic vibrations within the dwelling.",
            "Align the space with Vastu Purusha energies and directional harmony.",
            "Invite Lakshmi, prosperity, nourishment, and protective grace.",
            "Establish Agni as the purifier and carrier of sacred offerings.",
            "Stabilize planetary influences through Navagraha worship and mantra.",
        ],
        "deities": [
            {
                "name": "Lord Ganesha",
                "role": "Remover of obstacles",
                "importance": "Worshipped first to ensure peaceful beginnings, stability, prosperity, and a smooth domestic life.",
                "reasons": ["Removes hindrances", "Blesses the family with stability", "Supports a harmonious transition into the new home"],
            },
            {
                "name": "Vastu Purusha",
                "role": "Guardian of the house",
                "importance": "Honored as the spiritual presence within the land and structure to harmonize subtle energies and remove Vastu pressure.",
                "reasons": ["Balances directions", "Protects the dwelling", "Reduces Vastu doshas"],
            },
            {
                "name": "Goddess Lakshmi",
                "role": "Prosperity and abundance",
                "importance": "Invoked for financial prosperity, beauty, nourishment, and auspicious household vibrations.",
                "reasons": ["Invites abundance", "Blesses family happiness", "Supports a flourishing home atmosphere"],
            },
            {
                "name": "Lord Vishnu",
                "role": "Preservation and stability",
                "importance": "Worshipped for protection, long-term peace, and righteous family life. Satyanarayana Puja is often included.",
                "reasons": ["Sustains domestic harmony", "Protects the family structure", "Anchors dharmic living"],
            },
            {
                "name": "Agni",
                "role": "Sacred fire",
                "importance": "Carries offerings to the gods through havan while purifying the atmosphere and sanctifying the environment.",
                "reasons": ["Transforms energy", "Purifies the home", "Creates spiritual protection"],
            },
            {
                "name": "Navagrahas",
                "role": "Planetary harmony",
                "importance": "Worshipped to reduce planetary afflictions that may affect health, finances, stability, and wellbeing in the new space.",
                "reasons": ["Softens graha pressure", "Aligns timing", "Supports karmic balance"],
            },
        ],
        "mantras": [
            {"title": "Ganesha mantra", "chant": "Om Gam Ganapataye Namah", "purpose": "Invoked first to remove obstacles and steady the beginning."},
            {"title": "Vastu mantra", "chant": "Om Vastu Purushaya Namah", "purpose": "Offered to harmonize the subtle energies of the dwelling."},
            {"title": "Lakshmi mantra", "chant": "Om Shreem Mahalakshmyai Namah", "purpose": "Used to invite prosperity, nourishment, and auspicious abundance."},
            {"title": "Vishnu mantra", "chant": "Om Namo Narayanaya", "purpose": "Supports preservation, peace, and righteous household stability."},
            {"title": "Agni invocation", "chant": "Om Agnaye Swaha", "purpose": "Consecrates the sacred fire and carries offerings through havan."},
            {"title": "Navagraha salutation", "chant": "Om Navagrahebhyo Namah", "purpose": "Seeks harmony from the nine grahas during home entry."},
        ],
        "steps": [
            {
                "title": "Cleaning and purification",
                "description": "The home is physically cleaned and energetically purified, often with Gangajal, gomutra mixtures, or salt-water cleansing.",
                "points": ["Physical + subtle purification", "Prepares the home to receive sacred ritual energy"],
            },
            {
                "title": "Decoration and welcome symbols",
                "description": "Mango leaves toran, banana stems, rangoli, flowers, and diyas are used to welcome auspiciousness into the home.",
                "points": ["Mango leaves represent life energy", "Lamps represent divine consciousness", "Rangoli welcomes prosperity"],
            },
            {
                "title": "Kalasha preparation and house entry",
                "description": "A kalasha with water, mango leaves, and coconut is carried into the house, usually with the right foot first.",
                "points": ["Represents cosmic creation and divine presence", "Marks auspicious beginning for the household"],
            },
            {
                "title": "Coconut breaking and Ganesha Puja",
                "description": "A coconut is broken at the entrance, followed by Ganesha worship with flowers, durva, turmeric, and kumkum.",
                "points": ["Signifies destruction of ego", "Removes obstacles before the full ritual begins"],
            },
            {
                "title": "Punyahavachanam and Vastu Puja",
                "description": "The priest chants purification mantras, sprinkles sanctified water, and performs Vastu Purusha worship.",
                "points": ["Sanctifies the family and home", "Balances directional and structural energies"],
            },
            {
                "title": "Navagraha Puja and Havan",
                "description": "Navagraha worship and homa sequences such as Ganapati, Vastu, Lakshmi, or Sudarshana Homa are performed.",
                "points": ["Reduces astrological obstacles", "Purifies the environment through sacred fire"],
            },
            {
                "title": "Boiling milk and kitchen worship",
                "description": "Milk is boiled until it overflows, symbolizing abundance, fullness of life, and ever-growing prosperity.",
                "points": ["Invites Lakshmi", "Activates the kitchen as the nourishing heart of the home"],
            },
            {
                "title": "Satyanarayana Katha, Aarti, and Prasad",
                "description": "Many families conclude with Satyanarayana worship, bhajans, aarti, and prasad distribution to guests.",
                "points": ["Strengthens family harmony", "Completes the transition into a sacred home atmosphere"],
            },
        ],
        "objects": [
            {"name": "Coconut", "meaning": "Purity and surrender of ego"},
            {"name": "Kalasha", "meaning": "Cosmic creation and divine presence"},
            {"name": "Mango leaves", "meaning": "Life energy and fertility"},
            {"name": "Diya", "meaning": "Divine light and awareness"},
            {"name": "Rice", "meaning": "Abundance and nourishment"},
            {"name": "Turmeric and Kumkum", "meaning": "Auspiciousness and sacred blessing"},
            {"name": "Sacred Fire", "meaning": "Purification and energy transformation"},
        ],
        "regional_variations": [
            {"region": "South India", "variation": "A cow may enter first as a living symbol of auspicious life energy."},
            {"region": "Bengal", "variation": "Lakshmi emphasis is often stronger in household invocation rituals."},
            {"region": "Maharashtra", "variation": "Satyanarayana Puja is a common and prominent inclusion."},
            {"region": "North India", "variation": "Vastu Havan is often performed more elaborately."},
            {"region": "Gujarat", "variation": "Rice and kumkum threshold rituals are common."},
        ],
        "avoidances": [
            "Avoid entering during Rahu Kalam.",
            "Avoid moving in before structural completion.",
            "Avoid conflict, harsh speech, or a dark unlit home during entry.",
            "Avoid leaving the kitchen inactive or symbolically empty.",
        ],
        "scientific_notes": [
            "Havan smoke is traditionally associated with antimicrobial herbs and an uplifting aromatic environment.",
            "Cleaning, decoration, and collective prayer establish psychological positivity and family bonding.",
            "Muhurat gives symbolic alignment, confidence, and a sense of intentional beginning.",
        ],
        "core_meaning": [
            "It transforms a structure into a sacred home.",
            "It aligns domestic life with cosmic order and dharma.",
            "It consecrates the house as a place of family, worship, learning, compassion, and spiritual evolution.",
        ],
    },
    "marriage": {
        "sanskrit_title": "Vivāha Saṁskāra",
        "headline": "Sacred union, vows, family harmony, and dharmic partnership",
        "hero_description": (
            "Vivāha is not only a social event but a sacred saṁskāra that joins two individuals, two lineages, and two karmic paths through dharma, companionship, and sacred fire."
        ),
        "overview": [
            "The ceremony aligns the couple with gṛhastha dharma, family continuity, and mutual spiritual support.",
            "Regional customs differ, but the essential purpose remains commitment, prosperity, protection, and righteous partnership.",
        ],
        "types": [
            {"title": "Traditional full ceremony", "meaning": "Includes Ganesh Puja, Kanyadaan, Mangal Pheras, Saptapadi, and blessings."},
            {"title": "Compact wedding ritual", "meaning": "A shorter format for intimate ceremonies while preserving core saṁskāra elements."},
        ],
        "timing": {
            "auspicious_months": ["Margashirsha", "Magha", "Phalguna", "Vaishakha"],
            "avoided_periods": ["Adhik Maas in some traditions", "Inauspicious transit windows", "Unapproved family or regional blackout periods"],
            "nakshatras": ["Rohini", "Mrigashira", "Magha", "Uttara Phalguni", "Hasta", "Revati"],
            "rule": "Muhurat should be selected with attention to tithi, nakshatra, lagna, and family tradition.",
        },
        "spiritual_points": [
            "Consecrates companionship through sacred vows.",
            "Invokes Agni as witness to the commitment.",
            "Aligns prosperity, fertility, and emotional steadiness for the new household.",
        ],
        "deities": [
            {"name": "Lord Ganesha", "role": "Smooth beginning", "importance": "Invoked first to remove obstacles.", "reasons": ["Stability", "Ease", "Blessed start"]},
            {"name": "Agni", "role": "Witness to vows", "importance": "The sacred fire sanctifies the promises made by the couple.", "reasons": ["Purity", "Witness", "Transformation"]},
            {"name": "Lakshmi and Vishnu", "role": "Prosperity and sustenance", "importance": "Bless household balance and mutual support.", "reasons": ["Prosperity", "Peace", "Continuity"]},
        ],
        "mantras": [
            {"title": "Ganesh mantra", "chant": "Om Gam Ganapataye Namah", "purpose": "Begins the ceremony with obstacle removal and steadiness."},
            {"title": "Mangalashtakam", "chant": "Traditional mangala verses chanted during auspicious wedding moments", "purpose": "Sanctifies the union and invokes blessing during the ceremony."},
            {"title": "Agni sakshi mantra", "chant": "Sacred fire witness mantras during pheras", "purpose": "Seals vows before Agni as divine witness."},
            {"title": "Saptapadi mantras", "chant": "Seven vow mantras recited with each step", "purpose": "Establishes the spiritual and practical vows of marriage."},
        ],
        "steps": [
            {"title": "Ganesh Puja and welcome rites", "description": "Begins with obstacle removal and ritual preparation.", "points": ["Purifies the mandap", "Stabilizes the ceremony flow"]},
            {"title": "Kanyadaan and sankalpa", "description": "The sacred intention of union is formally offered and accepted.", "points": ["Family witness", "Dharmic commitment"]},
            {"title": "Mangal pheras and Saptapadi", "description": "The couple circumambulates Agni and takes seven essential vows.", "points": ["Shared duties", "Mutual respect", "Prosperity and faithfulness"]},
            {"title": "Aashirvada", "description": "Blessings from elders seal the rite with social and spiritual acceptance.", "points": ["Lineage blessing", "Community support"]},
        ],
        "objects": [
            {"name": "Agni", "meaning": "Witness to the marriage vows"},
            {"name": "Mangal Sutra / Sindoor", "meaning": "Visible symbols of committed union"},
            {"name": "Rice and flowers", "meaning": "Blessings, abundance, and goodwill"},
        ],
        "regional_variations": [
            {"region": "North India", "variation": "Pheras around Agni are central."},
            {"region": "South India", "variation": "Tying of Mangalsutra and regional mantra traditions are emphasized."},
            {"region": "Bengal", "variation": "Shubho Drishti and traditional visual rituals are prominent."},
        ],
        "avoidances": ["Avoid weak muhurat windows", "Avoid incomplete sankalpa planning", "Avoid mismatch between ritual sequence and family sampradāya"],
        "core_meaning": ["Marriage becomes a dharmic partnership, not only a contract.", "The rite establishes a sacred foundation for family, prosperity, and spiritual companionship."],
    },
    "satyanarayan": {
        "sanskrit_title": "Śrī Satyanārāyaṇa Pūjā",
        "headline": "A devotional household vrata for peace, gratitude, and steady prosperity",
        "hero_description": (
            "Satyanarayana Puja is a widely loved Vishnu-centered household ritual performed for grace, stability, fulfilment of wishes, and the cultivation of devotion with truthfulness."
        ),
        "overview": [
            "Often chosen for milestones such as moving home, birthdays, anniversaries, business openings, or thanksgiving after a positive outcome.",
            "It combines katha, puja, sankalpa, and family participation in a highly accessible devotional format.",
        ],
        "types": [
            {"title": "Milestone puja", "meaning": "Performed after achievements or transitions such as new home, business, or family celebrations."},
            {"title": "Regular devotional observance", "meaning": "Observed monthly or on special tithis for continuity of blessings."},
        ],
        "timing": {
            "auspicious_months": ["Any month with an approved muhurat"],
            "avoided_periods": ["Inauspicious family blackout periods if observed"],
            "nakshatras": ["Rohini", "Anuradha", "Shravana", "Revati"],
            "rule": "Most households perform it in the evening or on Purnima-related devotional timings.",
        },
        "spiritual_points": [
            "Strengthens devotion to Vishnu through truthfulness and gratitude.",
            "Invites peace, protection, and domestic harmony.",
            "Supports a calm, family-centered devotional atmosphere.",
        ],
        "deities": [
            {"name": "Satyanarayana", "role": "Form of Vishnu", "importance": "Blesses truth-aligned living, stability, and grace.", "reasons": ["Peace", "Prosperity", "Devotion"]},
            {"name": "Lakshmi", "role": "Auspicious abundance", "importance": "Often invoked alongside Vishnu for household wellbeing.", "reasons": ["Nourishment", "Harmony", "Prosperity"]},
        ],
        "mantras": [
            {"title": "Vishnu mantra", "chant": "Om Namo Bhagavate Vasudevaya", "purpose": "Centers the puja in devotion to Vishnu."},
            {"title": "Narayana mantra", "chant": "Om Namo Narayanaya", "purpose": "Invokes sustaining peace and divine grace."},
            {"title": "Satyanarayana katha recitation", "chant": "Katha passages and vrat narrative", "purpose": "Carries the devotional teaching of truthfulness and gratitude."},
        ],
        "steps": [
            {"title": "Sankalpa and setup", "description": "The family states intent and prepares the altar with fruits, tulsi, and prasad.", "points": ["Clarity of purpose", "Clean devotional environment"]},
            {"title": "Puja and katha", "description": "The narrative and offerings teach truthfulness, humility, and gratitude.", "points": ["Family participation", "Moral and devotional reinforcement"]},
            {"title": "Aarti and prasad", "description": "Concludes with blessings and distribution of sacred prasad.", "points": ["Shared devotion", "Auspicious closure"]},
        ],
        "objects": [
            {"name": "Tulsi", "meaning": "Beloved to Vishnu and central to the puja"},
            {"name": "Prasad", "meaning": "Grace received and shared"},
            {"name": "Katha text", "meaning": "Devotional teaching and remembrance"},
        ],
        "regional_variations": [{"region": "Across India", "variation": "The ritual remains highly consistent, with slight differences in prasad, katha recitation, and family customs."}],
        "avoidances": ["Avoid rushed katha reading", "Avoid neglecting sankalpa clarity", "Avoid reducing the ritual to form alone without devotional intent"],
        "core_meaning": ["The puja cultivates gratitude, sincerity, and a devotional household center.", "It reinforces that prosperity is best sustained through truth, humility, and remembrance of the divine."],
    },
    "rudrabhishek": {
        "sanskrit_title": "Rudrābhiṣeka",
        "headline": "Shiva worship for purification, courage, health, and inner steadiness",
        "hero_description": (
            "Rudrabhishek is a powerful Shaiva ritual in which Lord Shiva is worshipped with sacred offerings, Vedic chant, and abhishek to invite purification, calm strength, and karmic relief."
        ),
        "overview": [
            "It is often chosen during periods of pressure, health concern, spiritual seeking, or the need for mental and energetic reset.",
            "The ritual may be performed as a personal sankalpa, family remedy, or festival observance.",
        ],
        "types": [
            {"title": "Basic abhishek", "meaning": "Focused Shiva puja with milk, water, bilva, and mantra."},
            {"title": "Laghu Rudra / expanded homa", "meaning": "A larger format with extended chant or homa depending on tradition."},
        ],
        "timing": {
            "auspicious_months": ["Shravan", "Kartika", "Magha", "Mahashivaratri periods"],
            "avoided_periods": ["Primarily timing is adjusted for family and priest guidance rather than broadly avoided"],
            "nakshatras": ["Ardra", "Mrigashira", "Hasta", "Anuradha"],
            "rule": "Morning or pradosh-linked timings are often preferred depending on sampradāya.",
        },
        "spiritual_points": [
            "Purifies the mind and emotional field through Shiva mantra.",
            "Supports courage, detachment, and release of accumulated pressure.",
            "Creates a stabilizing devotional field for intense life phases.",
        ],
        "deities": [
            {"name": "Lord Shiva", "role": "Transformation and grace", "importance": "Central deity of the ritual, worshipped for purification and protection.", "reasons": ["Inner steadiness", "Release", "Blessing"]},
            {"name": "Nandi and Rudra forms", "role": "Witness and cosmic guardianship", "importance": "Honored within expanded Shaiva traditions.", "reasons": ["Discipline", "Devotion", "Protective force"]},
        ],
        "mantras": [
            {"title": "Panchakshari mantra", "chant": "Om Namah Shivaya", "purpose": "The principal Shiva mantra for surrender, purification, and grace."},
            {"title": "Maha Mrityunjaya mantra", "chant": "Om Tryambakam Yajamahe Sugandhim Pushtivardhanam", "purpose": "Invoked for healing, protection, and release from fear."},
            {"title": "Sri Rudram", "chant": "Namakam and Chamakam recitation", "purpose": "Deepens the Vedic force of the abhishek and Shiva worship."},
        ],
        "steps": [
            {"title": "Sankalpa and linga preparation", "description": "The ritual begins with intent and altar sanctification.", "points": ["Purity", "Focused invocation"]},
            {"title": "Abhishek sequence", "description": "Water, milk, curd, honey, ghee, and bilva may be offered while mantras are chanted.", "points": ["Purification", "Cooling", "Grace"]},
            {"title": "Rudra chant and aarti", "description": "The energy is stabilized through Vedic recitation and devotional completion.", "points": ["Protective field", "Spiritual completion"]},
        ],
        "objects": [
            {"name": "Bilva leaves", "meaning": "Beloved offering to Shiva"},
            {"name": "Abhishek dravya", "meaning": "Purification through sacred substances"},
            {"name": "Rudra mantra", "meaning": "Invokes protective and transformative grace"},
        ],
        "regional_variations": [{"region": "North and South India", "variation": "The specific abhishek materials, chant length, and inclusion of homa vary by tradition."}],
        "avoidances": ["Avoid casual or distracted participation", "Avoid mismatched mantra pacing", "Avoid treating the ritual as mechanical when it is meant to steady the inner field"],
        "core_meaning": ["Rudrabhishek invites cleansing, surrender, courage, and silent strength.", "It is especially resonant when life needs purification and centered resolve."],
    },
    "naming_ceremony": {
        "sanskrit_title": "Nāmakaraṇa Saṁskāra",
        "headline": "Auspicious naming, blessing of the child, and alignment with identity",
        "hero_description": (
            "Naamkaran is the sacred naming rite through which a child is welcomed into family and society with blessings, identity, and auspicious intention."
        ),
        "overview": [
            "The ritual often considers nakshatra, family lineage, deity connection, and the emotional quality the family wishes to invoke in the child’s life.",
            "It may be simple and intimate or more elaborate with havan and extended blessings.",
        ],
        "types": [
            {"title": "Nakshatra-based naming", "meaning": "Name syllables are chosen based on the child’s birth nakshatra and pada."},
            {"title": "Family or deity naming", "meaning": "A name is selected to honor lineage, guru, or a chosen deity while retaining auspicious structure."},
        ],
        "timing": {
            "auspicious_months": ["Usually timed by the child’s post-birth ritual calendar"],
            "avoided_periods": ["Inauspicious days as advised by priest and family tradition"],
            "nakshatras": ["Ashwini", "Rohini", "Punarvasu", "Hasta", "Revati"],
            "rule": "The rite is usually scheduled with attention to both maternal recovery and an auspicious muhurat.",
        },
        "spiritual_points": [
            "Blesses the child with identity, sound vibration, and loving intention.",
            "Connects the child to lineage, dharma, and family protection.",
            "Creates an early sacred milestone in the child’s life journey.",
        ],
        "deities": [
            {"name": "Ganesha", "role": "Blessed beginning", "importance": "Removes obstacles from the child’s path.", "reasons": ["Protection", "Ease", "Auspicious start"]},
            {"name": "Family deity / Ishta devata", "role": "Lineage blessing", "importance": "Anchors the naming in devotion and family faith.", "reasons": ["Identity", "Belonging", "Blessing"]},
        ],
        "mantras": [
            {"title": "Ganesh mantra", "chant": "Om Shri Ganeshaya Namah", "purpose": "Blesses the child with auspicious beginnings."},
            {"title": "Ayushya recitation", "chant": "Ayushya Sukta or child blessing mantras", "purpose": "Invokes health, longevity, and vitality."},
            {"title": "Nakshatra syllable guidance", "chant": "Birth-star based syllable or beeja sound", "purpose": "Aligns the chosen name with the child’s birth pattern."},
            {"title": "Saraswati prayer", "chant": "Om Aim Saraswatyai Namah", "purpose": "Blesses speech, intelligence, and graceful expression."},
        ],
        "steps": [
            {"title": "Purification and sankalpa", "description": "The family sets intention for the child’s life and wellbeing.", "points": ["Blessed welcome", "Protection"]},
            {"title": "Name selection and whispering", "description": "The chosen name is spoken softly to the child, often by the father or officiating elder.", "points": ["Identity", "Sound blessing", "Affection"]},
            {"title": "Blessings and prasad", "description": "Elders bless the child and family with prosperity, health, and virtue.", "points": ["Lineage support", "Community welcome"]},
        ],
        "objects": [
            {"name": "Rice tray or writing surface", "meaning": "Sometimes used to inscribe the name symbolically"},
            {"name": "Flowers and kumkum", "meaning": "Blessing, affection, and auspiciousness"},
            {"name": "Birth details", "meaning": "Guide nakshatra-aligned name choices"},
        ],
        "regional_variations": [{"region": "Pan-India", "variation": "Some families emphasize astrology, some lineage names, and some deity devotion more strongly."}],
        "avoidances": ["Avoid rushed name decisions without family alignment", "Avoid discarding birth-based syllable guidance if it matters to the family tradition"],
        "core_meaning": ["A name is treated as a vibration that accompanies the child through life.", "Naamkaran sanctifies identity with blessing, belonging, and loving intention."],
    },
}


def _generic_world(service):
    return {
        "sanskrit_title": service.name,
        "headline": "Traditional process, sacred meaning, and booking clarity",
        "hero_description": service.description or f"{service.name} can be planned with verified pandits, transparent pricing, and ritual guidance.",
        "overview": [service.description or "A sacred ritual presented with calm structure and clear ceremonial guidance."],
        "types": [{"title": "Standard ceremony", "meaning": "A traditional format executed with samagri guidance and priest-led flow."}],
        "timing": {
            "auspicious_months": ["Muhurat-led timing"],
            "avoided_periods": ["Inauspicious windows based on local tradition"],
            "nakshatras": ["Priest-guided selection"],
            "rule": "Timing and sequence should be chosen according to family tradition and priest guidance.",
        },
        "spiritual_points": ["Aligns the ritual with intention, family harmony, and sacred timing."],
        "deities": [],
        "steps": [{"title": "Priest-guided sequence", "description": "The ritual is conducted with sankalpa, mantra, offerings, and closure.", "points": ["Traditional pacing", "Clear family guidance"]}],
        "mantras": [
            {"title": "Sankalpa mantra", "chant": "Priest-guided sankalpa recitation", "purpose": "Establishes intention and dedicates the ritual correctly."},
            {"title": "Ganesh invocation", "chant": "Om Gam Ganapataye Namah", "purpose": "Used broadly to remove obstacles before the ritual begins."},
        ],
        "objects": [],
        "regional_variations": [],
        "avoidances": ["Avoid rushed planning and incomplete ritual preparation."],
        "core_meaning": ["The ritual becomes more effective when entered with clarity, reverence, and complete preparation."],
    }


def build_service_worlds(services):
    worlds = []
    for service in services:
        template = deepcopy(CATEGORY_WORLD_LIBRARY.get(service.category) or _generic_world(service))
        template.update(
            {
                "slug": service.slug,
                "service_name": service.name,
                "category": service.category,
                "icon": service.icon or "🪔",
                "description": service.description,
                "base_price": service.base_price,
                "duration_minutes": service.duration_minutes,
                "is_featured": service.is_featured,
            }
        )
        worlds.append(template)
    return worlds

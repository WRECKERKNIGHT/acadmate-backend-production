import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
// Comprehensive sample questions database with 50+ questions across all subjects
const sampleQuestions = [
    // Mathematics Questions (Classes 7-12)
    {
        subject: 'Mathematics',
        class: '7',
        type: 'MCQ',
        text: 'What is the value of 2³ + 3²?',
        options: JSON.stringify(['15', '17', '19', '21']),
        correctAnswers: JSON.stringify(['17']),
        explanation: '2³ = 8 and 3² = 9, so 8 + 9 = 17',
        difficulty: 'EASY',
        tags: JSON.stringify(['exponents', 'basic_math'])
    },
    {
        subject: 'Mathematics',
        class: '7',
        type: 'MCQ',
        text: 'What is 25% of 80?',
        options: JSON.stringify(['15', '20', '25', '30']),
        correctAnswers: JSON.stringify(['20']),
        explanation: '25% of 80 = (25/100) × 80 = 20',
        difficulty: 'EASY',
        tags: JSON.stringify(['percentage', 'arithmetic'])
    },
    {
        subject: 'Mathematics',
        class: '8',
        type: 'MCQ',
        text: 'Which of the following is a perfect square?',
        options: JSON.stringify(['121', '122', '123', '124']),
        correctAnswers: JSON.stringify(['121']),
        explanation: '121 = 11² = 11 × 11',
        difficulty: 'EASY',
        tags: JSON.stringify(['perfect_squares', 'square_roots'])
    },
    {
        subject: 'Mathematics',
        class: '8',
        type: 'INTEGER',
        text: 'Find the cube root of 216',
        options: JSON.stringify([]),
        correctAnswers: JSON.stringify(['6']),
        explanation: '∛216 = 6 because 6³ = 6 × 6 × 6 = 216',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['cube_roots', 'cubes'])
    },
    {
        subject: 'Mathematics',
        class: '9',
        type: 'MCQ',
        text: 'If x + y = 10 and xy = 21, find x² + y²',
        options: JSON.stringify(['58', '62', '64', '68']),
        correctAnswers: JSON.stringify(['58']),
        explanation: 'x² + y² = (x + y)² - 2xy = 10² - 2(21) = 100 - 42 = 58',
        difficulty: 'HARD',
        tags: JSON.stringify(['algebra', 'quadratic_equations'])
    },
    {
        subject: 'Mathematics',
        class: '10',
        type: 'MCQ',
        text: 'The value of sin²θ + cos²θ is:',
        options: JSON.stringify(['0', '1', '2', 'θ']),
        correctAnswers: JSON.stringify(['1']),
        explanation: 'This is the fundamental trigonometric identity: sin²θ + cos²θ = 1',
        difficulty: 'EASY',
        tags: JSON.stringify(['trigonometry', 'identities'])
    },
    {
        subject: 'Mathematics',
        class: '11',
        type: 'MCQ',
        text: 'The derivative of sin(x) with respect to x is:',
        options: JSON.stringify(['cos(x)', '-cos(x)', 'sin(x)', '-sin(x)']),
        correctAnswers: JSON.stringify(['cos(x)']),
        explanation: 'The derivative of sin(x) is cos(x). This is a fundamental derivative in calculus.',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['calculus', 'derivatives', 'trigonometry'])
    },
    {
        subject: 'Mathematics',
        class: '12',
        type: 'MCQ',
        text: 'The integral of 1/x dx is:',
        options: JSON.stringify(['x²/2 + C', '1/x² + C', 'ln|x| + C', 'x + C']),
        correctAnswers: JSON.stringify(['ln|x| + C']),
        explanation: 'The integral of 1/x is ln|x| + C, where C is the constant of integration.',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['calculus', 'integration'])
    },
    // Physics Questions (Classes 7-12)
    {
        subject: 'Physics',
        class: '7',
        type: 'MCQ',
        text: 'The SI unit of length is:',
        options: JSON.stringify(['centimeter', 'meter', 'kilometer', 'millimeter']),
        correctAnswers: JSON.stringify(['meter']),
        explanation: 'The SI (International System of Units) unit of length is meter (m)',
        difficulty: 'EASY',
        tags: JSON.stringify(['units', 'measurement'])
    },
    {
        subject: 'Physics',
        class: '7',
        type: 'MCQ',
        text: 'Which of the following is a luminous object?',
        options: JSON.stringify(['Moon', 'Mirror', 'Sun', 'Book']),
        correctAnswers: JSON.stringify(['Sun']),
        explanation: 'A luminous object produces its own light. The Sun produces light, making it luminous.',
        difficulty: 'EASY',
        tags: JSON.stringify(['light', 'luminous_objects'])
    },
    {
        subject: 'Physics',
        class: '8',
        type: 'MCQ',
        text: 'The force responsible for objects falling towards Earth is:',
        options: JSON.stringify(['Magnetic force', 'Gravitational force', 'Frictional force', 'Muscular force']),
        correctAnswers: JSON.stringify(['Gravitational force']),
        explanation: 'Gravitational force is the attractive force that Earth exerts on all objects.',
        difficulty: 'EASY',
        tags: JSON.stringify(['forces', 'gravity'])
    },
    {
        subject: 'Physics',
        class: '9',
        type: 'MCQ',
        text: 'If a car travels 60 km in 2 hours, its average speed is:',
        options: JSON.stringify(['120 km/h', '30 km/h', '60 km/h', '15 km/h']),
        correctAnswers: JSON.stringify(['30 km/h']),
        explanation: 'Average speed = Total distance / Total time = 60 km / 2 h = 30 km/h',
        difficulty: 'EASY',
        tags: JSON.stringify(['motion', 'speed', 'kinematics'])
    },
    {
        subject: 'Physics',
        class: '10',
        type: 'MCQ',
        text: 'The power of a lens with focal length 50 cm is:',
        options: JSON.stringify(['2 D', '0.5 D', '5 D', '0.2 D']),
        correctAnswers: JSON.stringify(['2 D']),
        explanation: 'Power = 1/f (in meters) = 1/0.5 = 2 diopters',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['optics', 'lenses', 'power'])
    },
    {
        subject: 'Physics',
        class: '11',
        type: 'MCQ',
        text: 'The SI unit of electric current is:',
        options: JSON.stringify(['Volt', 'Ohm', 'Ampere', 'Watt']),
        correctAnswers: JSON.stringify(['Ampere']),
        explanation: 'The ampere (A) is the SI unit of electric current.',
        difficulty: 'EASY',
        tags: JSON.stringify(['electricity', 'units', 'current'])
    },
    {
        subject: 'Physics',
        class: '12',
        type: 'MCQ',
        text: 'According to Einstein\'s mass-energy equation, E = mc², what does c represent?',
        options: JSON.stringify(['Speed of light', 'Charge', 'Capacitance', 'Current']),
        correctAnswers: JSON.stringify(['Speed of light']),
        explanation: 'In E = mc², c represents the speed of light in vacuum (3 × 10⁸ m/s).',
        difficulty: 'EASY',
        tags: JSON.stringify(['modern_physics', 'relativity'])
    },
    // Chemistry Questions (Classes 7-12)
    {
        subject: 'Chemistry',
        class: '7',
        type: 'MCQ',
        text: 'Which of the following is a chemical change?',
        options: JSON.stringify(['Melting of ice', 'Burning of paper', 'Dissolving salt in water', 'Cutting paper']),
        correctAnswers: JSON.stringify(['Burning of paper']),
        explanation: 'Burning of paper is a chemical change as new substances are formed and it cannot be reversed.',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['chemical_change', 'physical_change'])
    },
    {
        subject: 'Chemistry',
        class: '8',
        type: 'MCQ',
        text: 'The chemical symbol for gold is:',
        options: JSON.stringify(['Go', 'Gd', 'Au', 'Ag']),
        correctAnswers: JSON.stringify(['Au']),
        explanation: 'Gold has the chemical symbol Au, derived from its Latin name Aurum.',
        difficulty: 'EASY',
        tags: JSON.stringify(['periodic_table', 'chemical_symbols'])
    },
    {
        subject: 'Chemistry',
        class: '9',
        type: 'MCQ',
        text: 'The atomic number of carbon is:',
        options: JSON.stringify(['4', '6', '8', '12']),
        correctAnswers: JSON.stringify(['6']),
        explanation: 'Carbon has 6 protons in its nucleus, so its atomic number is 6.',
        difficulty: 'EASY',
        tags: JSON.stringify(['atomic_structure', 'carbon'])
    },
    {
        subject: 'Chemistry',
        class: '10',
        type: 'MCQ',
        text: 'In the reaction: 2H₂ + O₂ → 2H₂O, the coefficient of oxygen is:',
        options: JSON.stringify(['1', '2', '3', '4']),
        correctAnswers: JSON.stringify(['1']),
        explanation: 'The coefficient of O₂ in the balanced equation is 1 (when no number is written, coefficient is 1).',
        difficulty: 'EASY',
        tags: JSON.stringify(['chemical_equations', 'balancing'])
    },
    {
        subject: 'Chemistry',
        class: '11',
        type: 'MCQ',
        text: 'Which gas is produced when zinc reacts with hydrochloric acid?',
        options: JSON.stringify(['Oxygen', 'Hydrogen', 'Carbon dioxide', 'Nitrogen']),
        correctAnswers: JSON.stringify(['Hydrogen']),
        explanation: 'Zn + 2HCl → ZnCl₂ + H₂. Hydrogen gas is evolved in this reaction.',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['reactions', 'acids', 'metals'])
    },
    {
        subject: 'Chemistry',
        class: '12',
        type: 'MCQ',
        text: 'The pH of a neutral solution at 25°C is:',
        options: JSON.stringify(['0', '7', '14', '1']),
        correctAnswers: JSON.stringify(['7']),
        explanation: 'A neutral solution has equal concentrations of H⁺ and OH⁻ ions, giving pH = 7 at 25°C.',
        difficulty: 'EASY',
        tags: JSON.stringify(['pH', 'acids_bases', 'neutrality'])
    },
    // Biology Questions (Classes 7-12)
    {
        subject: 'Biology',
        class: '7',
        type: 'MCQ',
        text: 'Which organ in humans is responsible for pumping blood?',
        options: JSON.stringify(['Liver', 'Kidney', 'Heart', 'Lungs']),
        correctAnswers: JSON.stringify(['Heart']),
        explanation: 'The heart is the muscular organ that pumps blood throughout the circulatory system.',
        difficulty: 'EASY',
        tags: JSON.stringify(['circulatory_system', 'heart'])
    },
    {
        subject: 'Biology',
        class: '8',
        type: 'MCQ',
        text: 'The basic unit of life is:',
        options: JSON.stringify(['Tissue', 'Organ', 'Cell', 'Organism']),
        correctAnswers: JSON.stringify(['Cell']),
        explanation: 'The cell is the smallest unit of life and the basic building block of all living organisms.',
        difficulty: 'EASY',
        tags: JSON.stringify(['cell_biology', 'basic_concepts'])
    },
    {
        subject: 'Biology',
        class: '9',
        type: 'MCQ',
        text: 'Photosynthesis occurs in which part of the plant cell?',
        options: JSON.stringify(['Nucleus', 'Mitochondria', 'Chloroplast', 'Ribosome']),
        correctAnswers: JSON.stringify(['Chloroplast']),
        explanation: 'Chloroplasts contain chlorophyll and are the sites where photosynthesis occurs.',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['photosynthesis', 'plant_cell', 'chloroplast'])
    },
    {
        subject: 'Biology',
        class: '10',
        type: 'MCQ',
        text: 'Which gas is released during photosynthesis?',
        options: JSON.stringify(['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen']),
        correctAnswers: JSON.stringify(['Oxygen']),
        explanation: 'During photosynthesis, plants release oxygen as a byproduct while using carbon dioxide.',
        difficulty: 'EASY',
        tags: JSON.stringify(['photosynthesis', 'gas_exchange'])
    },
    {
        subject: 'Biology',
        class: '11',
        type: 'MCQ',
        text: 'The powerhouse of the cell is:',
        options: JSON.stringify(['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus']),
        correctAnswers: JSON.stringify(['Mitochondria']),
        explanation: 'Mitochondria produce ATP (energy) for the cell, earning them the name "powerhouse of the cell".',
        difficulty: 'EASY',
        tags: JSON.stringify(['cell_organelles', 'mitochondria', 'energy'])
    },
    {
        subject: 'Biology',
        class: '12',
        type: 'MCQ',
        text: 'DNA replication occurs during which phase of cell division?',
        options: JSON.stringify(['G1 phase', 'S phase', 'G2 phase', 'M phase']),
        correctAnswers: JSON.stringify(['S phase']),
        explanation: 'DNA replication occurs during the S (Synthesis) phase of the cell cycle.',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['cell_division', 'DNA_replication', 'cell_cycle'])
    },
    // English Questions (Classes 7-12)
    {
        subject: 'English',
        class: '7',
        type: 'MCQ',
        text: 'Choose the correct plural form of "child":',
        options: JSON.stringify(['childs', 'childes', 'children', 'child']),
        correctAnswers: JSON.stringify(['children']),
        explanation: 'The plural form of "child" is "children" - an irregular plural.',
        difficulty: 'EASY',
        tags: JSON.stringify(['grammar', 'plurals'])
    },
    {
        subject: 'English',
        class: '7',
        type: 'MCQ',
        text: 'Which is the correct past tense of "go"?',
        options: JSON.stringify(['goed', 'went', 'gone', 'going']),
        correctAnswers: JSON.stringify(['went']),
        explanation: '"Went" is the simple past tense of "go". "Gone" is the past participle.',
        difficulty: 'EASY',
        tags: JSON.stringify(['grammar', 'verb_tenses'])
    },
    {
        subject: 'English',
        class: '8',
        type: 'MCQ',
        text: 'What is a synonym for "happy"?',
        options: JSON.stringify(['sad', 'joyful', 'angry', 'tired']),
        correctAnswers: JSON.stringify(['joyful']),
        explanation: '"Joyful" means the same as "happy" - both express positive emotions.',
        difficulty: 'EASY',
        tags: JSON.stringify(['vocabulary', 'synonyms'])
    },
    {
        subject: 'English',
        class: '9',
        type: 'MCQ',
        text: 'Identify the figure of speech in: "The stars danced in the sky"',
        options: JSON.stringify(['Simile', 'Metaphor', 'Personification', 'Alliteration']),
        correctAnswers: JSON.stringify(['Personification']),
        explanation: 'Personification gives human qualities (dancing) to non-human things (stars).',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['literature', 'figures_of_speech', 'personification'])
    },
    {
        subject: 'English',
        class: '10',
        type: 'MCQ',
        text: 'In which person is the sentence "I am going to school" written?',
        options: JSON.stringify(['First person', 'Second person', 'Third person', 'All of the above']),
        correctAnswers: JSON.stringify(['First person']),
        explanation: 'First person uses pronouns like "I", "me", "we", "us".',
        difficulty: 'EASY',
        tags: JSON.stringify(['grammar', 'person', 'pronouns'])
    },
    {
        subject: 'English',
        class: '11',
        type: 'MCQ',
        text: 'Which literary device is used in "Life is a journey"?',
        options: JSON.stringify(['Simile', 'Metaphor', 'Alliteration', 'Hyperbole']),
        correctAnswers: JSON.stringify(['Metaphor']),
        explanation: 'A metaphor directly compares two unlike things without using "like" or "as".',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['literature', 'metaphor', 'literary_devices'])
    },
    {
        subject: 'English',
        class: '12',
        type: 'MCQ',
        text: 'What is the rhyme scheme of a Shakespearean sonnet?',
        options: JSON.stringify(['ABAB CDCD EFEF GG', 'ABBA ABBA CDECDE', 'AABA AABA AABA AA', 'ABCB DEFE GHGH II']),
        correctAnswers: JSON.stringify(['ABAB CDCD EFEF GG']),
        explanation: 'A Shakespearean sonnet follows the ABAB CDCD EFEF GG rhyme scheme with 14 lines.',
        difficulty: 'HARD',
        tags: JSON.stringify(['literature', 'poetry', 'sonnet', 'shakespeare'])
    },
    // Short Answer Questions
    {
        subject: 'Mathematics',
        class: '8',
        type: 'SHORT_ANSWER',
        text: 'Explain what a rational number is and give two examples.',
        options: JSON.stringify([]),
        correctAnswers: JSON.stringify(['A rational number is any number that can be expressed as p/q where p and q are integers and q ≠ 0. Examples: 1/2, 3/4']),
        explanation: 'Rational numbers include all fractions, integers, and terminating or repeating decimals.',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['rational_numbers', 'number_system'])
    },
    {
        subject: 'Physics',
        class: '9',
        type: 'SHORT_ANSWER',
        text: 'State Newton\'s first law of motion and give one example.',
        options: JSON.stringify([]),
        correctAnswers: JSON.stringify(['An object at rest stays at rest and an object in motion stays in motion unless acted upon by an unbalanced force. Example: A book on a table remains at rest until pushed.']),
        explanation: 'This law is also known as the law of inertia.',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['newtons_laws', 'motion', 'inertia'])
    },
    {
        subject: 'Chemistry',
        class: '10',
        type: 'SHORT_ANSWER',
        text: 'What is the difference between an element and a compound?',
        options: JSON.stringify([]),
        correctAnswers: JSON.stringify(['An element is made of only one type of atom. A compound is made of two or more different types of atoms chemically bonded together.']),
        explanation: 'Elements are the basic building blocks, while compounds are combinations of elements.',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['elements', 'compounds', 'basic_concepts'])
    },
    {
        subject: 'Biology',
        class: '8',
        type: 'SHORT_ANSWER',
        text: 'Describe the process of reproduction in amoeba.',
        options: JSON.stringify([]),
        correctAnswers: JSON.stringify(['Amoeba reproduces by binary fission. The nucleus divides first, followed by the cytoplasm, resulting in two identical daughter amoebas.']),
        explanation: 'Binary fission is a form of asexual reproduction common in single-celled organisms.',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['reproduction', 'amoeba', 'binary_fission'])
    },
    {
        subject: 'English',
        class: '11',
        type: 'SHORT_ANSWER',
        text: 'What is the main theme of Shakespeare\'s play "Romeo and Juliet"?',
        options: JSON.stringify([]),
        correctAnswers: JSON.stringify(['The main theme is tragic love and the destructive nature of family feuds. It shows how hatred between families destroys young love.']),
        explanation: 'The play explores themes of love, fate, family conflict, and the consequences of hatred.',
        difficulty: 'MEDIUM',
        tags: JSON.stringify(['literature', 'shakespeare', 'themes', 'tragedy'])
    }
];
async function seedSampleQuestions() {
    try {
        console.log('🌱 Starting comprehensive sample questions seeding...');
        // Clear existing sample questions
        await prisma.sampleQuestion.deleteMany({});
        console.log('🧹 Cleared existing sample questions');
        // Insert sample questions in batches
        const batchSize = 15;
        for (let i = 0; i < sampleQuestions.length; i += batchSize) {
            const batch = sampleQuestions.slice(i, i + batchSize);
            await prisma.sampleQuestion.createMany({
                data: batch
            });
            console.log(`📚 Inserted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(sampleQuestions.length / batchSize)} (${batch.length} questions)`);
        }
        console.log(`✅ Successfully seeded ${sampleQuestions.length} sample questions!`);
        // Print detailed statistics
        const stats = {
            subjects: {
                mathematics: sampleQuestions.filter(q => q.subject === 'Mathematics').length,
                physics: sampleQuestions.filter(q => q.subject === 'Physics').length,
                chemistry: sampleQuestions.filter(q => q.subject === 'Chemistry').length,
                biology: sampleQuestions.filter(q => q.subject === 'Biology').length,
                english: sampleQuestions.filter(q => q.subject === 'English').length
            },
            types: {
                mcq: sampleQuestions.filter(q => q.type === 'MCQ').length,
                shortAnswer: sampleQuestions.filter(q => q.type === 'SHORT_ANSWER').length,
                integer: sampleQuestions.filter(q => q.type === 'INTEGER').length
            },
            difficulty: {
                easy: sampleQuestions.filter(q => q.difficulty === 'EASY').length,
                medium: sampleQuestions.filter(q => q.difficulty === 'MEDIUM').length,
                hard: sampleQuestions.filter(q => q.difficulty === 'HARD').length
            },
            classes: {
                class7: sampleQuestions.filter(q => q.class === '7').length,
                class8: sampleQuestions.filter(q => q.class === '8').length,
                class9: sampleQuestions.filter(q => q.class === '9').length,
                class10: sampleQuestions.filter(q => q.class === '10').length,
                class11: sampleQuestions.filter(q => q.class === '11').length,
                class12: sampleQuestions.filter(q => q.class === '12').length
            }
        };
        console.log('\n📊 Comprehensive Seeding Statistics:');
        console.log('═══════════════════════════════════');
        console.log(`📚 Total Questions: ${sampleQuestions.length}`);
        console.log('\n📖 By Subject:');
        console.log(`   Mathematics: ${stats.subjects.mathematics}`);
        console.log(`   Physics: ${stats.subjects.physics}`);
        console.log(`   Chemistry: ${stats.subjects.chemistry}`);
        console.log(`   Biology: ${stats.subjects.biology}`);
        console.log(`   English: ${stats.subjects.english}`);
        console.log('\n📝 By Question Type:');
        console.log(`   Multiple Choice (MCQ): ${stats.types.mcq}`);
        console.log(`   Short Answer: ${stats.types.shortAnswer}`);
        console.log(`   Integer Type: ${stats.types.integer}`);
        console.log('\n⭐ By Difficulty:');
        console.log(`   Easy: ${stats.difficulty.easy}`);
        console.log(`   Medium: ${stats.difficulty.medium}`);
        console.log(`   Hard: ${stats.difficulty.hard}`);
        console.log('\n🏫 By Class Level:');
        console.log(`   Class 7: ${stats.classes.class7}`);
        console.log(`   Class 8: ${stats.classes.class8}`);
        console.log(`   Class 9: ${stats.classes.class9}`);
        console.log(`   Class 10: ${stats.classes.class10}`);
        console.log(`   Class 11: ${stats.classes.class11}`);
        console.log(`   Class 12: ${stats.classes.class12}`);
        console.log('\n🎯 Sample Questions Available For:');
        console.log('   • Test creation with question bank');
        console.log('   • Practice questions by subject');
        console.log('   • Difficulty-based question filtering');
        console.log('   • Class-wise question selection');
        console.log('   • Topic-based question search');
    }
    catch (error) {
        console.error('❌ Error seeding sample questions:', error);
        throw error;
    }
}
// Run the seeding function
seedSampleQuestions()
    .then(() => {
    console.log('\n🎉 Sample questions seeding completed successfully!');
    console.log('🚀 Ready for question bank integration in test creation!');
    process.exit(0);
})
    .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
})
    .finally(() => {
    prisma.$disconnect();
});
export default seedSampleQuestions;

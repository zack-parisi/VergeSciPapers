const { MongoClient } = require('mongodb');
require('dotenv').config();

// Uses MONGO_URI from .env
const mongoUri = process.env.MONGO_URI || 'mongodb+srv://vergesciences:4Z60L2dbCGZQzEsD@cluster07302004.9bzldqa.mongodb.net/';
const dbName = 'verge_neuro_lit_topics';
const collectionName = 'topics_v2';

// Provided topic names (numbers ignored)
const topicNames = [
  'Neural and Behavioral Psychology Studies',
  'Neurotransmitter Receptor Influence on Behavior',
  'Neuroscience and Neuropharmacology Research',
  'Child and Adolescent Psychosocial and Emotional Development',
  'Psychotherapy Techniques and Applications',
  'Social and Intergroup Psychology',
  'Neurobiology and Insect Physiology Research',
  'Neurobiology of Language and Bilingualism',
  'Psychometric Methodologies and Testing',
  'Psychological Well-being and Life Satisfaction',
  'Religion, Spirituality, and Psychology',
  'Psychopathy, Forensic Psychiatry, Sexual Offending',
  'Neurogenesis and neuroplasticity mechanisms',
  'Traumatic Brain Injury and Neurovascular Disturbances',
  'Neuroendocrine Tumor Research Advances',
  'Neuroscience and Music Perception',
  'Sport Psychology and Performance',
  'Neuropeptides and Animal Physiology',
  'Behavioral and Psychological Studies',
  'Anxiety, Depression, Psychometrics, Treatment, Cognitive Processes',
  'Neurological disorders and treatments',
  'Genetic Neurodegenerative Diseases',
  'Personality Traits and Psychology',
  'Creativity in Education and Neuroscience',
  'Personality Disorders and Psychopathology',
  'Evolutionary Psychology and Human Behavior',
  'Psychoanalysis and Psychopathology Research',
  'Neurofibromatosis and Schwannoma Cases',
  'Neuroinflammation and Neurodegeneration Mechanisms',
  'Botulinum Toxin and Related Neurological Disorders',
  'Advanced Neuroimaging Techniques and Applications',
  'Psychosomatic Disorders and Their Treatments',
  'Neuroscience of respiration and sleep',
  'Neuroendocrine regulation and behavior',
  'Neuroscience and Neural Engineering',
  'Autoimmune Neurological Disorders and Treatments',
  'Peripheral Neuropathies and Disorders',
  'Genetics and Neurodevelopmental Disorders',
  'Neuroethics, Human Enhancement, Biomedical Innovations',
  'Cholinesterase and Neurodegenerative Diseases',
  'Axon Guidance and Neuronal Signaling',
  'Neuroblastoma Research and Treatments',
  'Veterinary Orthopedics and Neurology',
  'Deception detection and forensic psychology',
  'Mental Health and Psychiatry',
  'Hereditary Neurological Disorders',
  'Neurogenetic and Muscular Disorders Research',
  'Academic and Historical Perspectives in Psychology',
  'Neurological Complications and Syndromes',
  'Intraoperative Neuromonitoring and Anesthetic Effects',
  'Psychology of Moral and Emotional Judgment',
  'Fetal and Pediatric Neurological Disorders',
  'Psychedelics and Drug Studies',
  'Hemispheric Asymmetry in Neuroscience',
  'Neurosurgical Procedures and Complications',
  'Historical Psychiatry and Medical Practices',
  'Psychology, Coaching, and Therapy',
  'Psychology and Mental Health',
  'Psychological Testing and Assessment',
  'Neurology and Historical Studies',
  'Psychoanalysis and Social Critique',
  'Jungian Analytical Psychology',
  'Psychoanalysis, Philosophy, and Politics',
  'Medicinal Plants and Neuroprotection',
  'Health, psychology, and well-being',
  'Anesthesia and Neurotoxicity Research',
  'Psychology of Development and Education',
  'Education, Psychology, and Social Research',
  'Neuroscience, Education and Cognitive Function',
  'Psychological Treatments and Disorders',
  'Psychological Treatments and Assessments',
  'Psychology Research and Bibliometrics',
  'Educational and Psychological Assessments',
  'Neurological diseases and metabolism',
  'Psychosocial Factors Impacting Youth',
  'Psychological and Temporal Perspectives Research',
  'Education, Psychology, and Complexity Research',
  'Psycholinguistics and Behavioral Studies',
  'Martial Arts: Techniques, Psychology, and Education',
  'Cognitive and psychological constructs research',
  'Transactional Analysis in Psychotherapy',
  'Neurological Disorders and Treatments',
  'Psychology of Social Influence',
  'Psychiatric care and mental health services',
  'Neurological and metabolic disorders',
  'Psychodrama and Leishmaniasis Studies',
  'Developmental and Educational Neuropsychology',
  'Neurological Disease Mechanisms and Treatments',
  'Educational Methods and Psychological Studies',
  'Cultural, Psychoanalytic, and Sociopolitical Reflections',
  'Psychological and Educational Research Studies',
  'Psychiatry, Mental Health, Neuroscience',
  'Undergraduate Neuroscience Education and Research',
  'Cardiovascular, Neuropeptides, and Oxidative Stress Research'
];

async function main() {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Ensure collection exists by creating if needed
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      await db.createCollection(collectionName);
      console.log(`Created collection: ${collectionName}`);
    } else {
      console.log(`Using existing collection: ${collectionName}`);
    }

    // Upsert a single document with a stable id
    const filter = { _id: 'topics_v2_root' };
    const update = {
      $set: {
        topic_names: topicNames,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    };

    const result = await collection.updateOne(filter, update, { upsert: true });

    if (result.upsertedCount > 0) {
      console.log(`Inserted topics_v2 document with ${topicNames.length} topic names`);
    } else if (result.matchedCount > 0) {
      console.log(`Updated topics_v2 document with ${topicNames.length} topic names`);
    } else {
      console.log('No changes made (document already up to date)');
    }

    // Read back and print a sample
    const doc = await collection.findOne({ _id: 'topics_v2_root' }, { projection: { topic_names: { $slice: 5 } } });
    console.log('Sample of topic_names:', doc?.topic_names || []);
  } catch (err) {
    console.error('Error seeding topics_v2:', err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();

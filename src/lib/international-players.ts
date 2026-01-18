// List of international players (non-Indian players)
export const INTERNATIONAL_PLAYERS: Set<string> = new Set([
  // Mumbai Indians
  "Trent Boult",
  "Mitchell Santner",
  "Ryan Rickelton",
  "Will Jacks",
  "Quinton de Kock",
  "Sherfane Rutherford",
  "Corbin Bosch",
  "Allah Ghazanfar",
  
  // Kolkata Knight Riders
  "Sunil Narine",
  "Cameron Green",
  "Matheesha Pathirana",
  "Rachin Ravindra",
  "Tim Seifert",
  "Rovman Powell",
  "Finn Allen",
  
  // Chennai Super Kings
  "Noor Ahmad",
  "Dewald Brevis",
  "Nathan Ellis",
  "Matt Henry",
  "Akeal Hosein",
  "Jamie Overton",
  "Mathew Short",
  "Zakary Foulkes",
  
  // Rajasthan Royals
  "Jofra Archer",
  "Shimron Hetmyer",
  "Sam Curran",
  "Lhuan-Dre Pretorious",
  "Donovan Ferreira",
  "Nandre Burger",
  "Adam Milne",
  "Kwena Maphaka",
  
  // Royal Challengers Bangalore
  "Phil Salt",
  "Josh Hazlewood",
  "Tim David",
  "Romario Shepherd",
  "Jacob Bethell",
  "Jacob Duffy",
  "Nuwan Thushara",
  "Jordan Cox",
  
  // Delhi Capitals
  "Mitchell Starc",
  "Tristan Stubbs",
  "David Miller",
  "Pathum Nissanka",
  "Kyle Jamieson",
  "Dushmantha Chameera",
  "Lungi Ngidi",
  "Ben Duckett",
  
  // Gujarat Titans
  "Jos Buttler",
  "Rashid Khan",
  "Kagiso Rabada",
  "Glenn Phillips",
  "Jason Holder",
  "Tom Banton",
  "Luke Wood",
  
  // Lucknow Super Giants
  "Nicholas Pooran",
  "Mitchell Marsh",
  "Aiden Markram",
  "Wanindu Hasaranga",
  "Anrich Nortje",
  "Matthew Breetzke",
  "Josh Inglis",
  
  // Punjab Kings
  "Marco Jansen",
  "Marcus Stoinis",
  "Lockie Ferguson",
  "Mitch Owen",
  "Azmatullah Omarzai",
  "Xavier Bartlett",
  "Cooper Connolly",
  "Ben Dwarshuis",
  
  // Sunrisers Hyderabad
  "Travis Head",
  "Heinrich Klaasen",
  "Pat Cummins",
  "Liam Livingstone",
  "Echan Malinga",
  "Brydon Carse",
  "Kamindu Mendis",
  "Jack Edwards",
]);

export function isInternationalPlayer(playerName: string): boolean {
  return INTERNATIONAL_PLAYERS.has(playerName);
}

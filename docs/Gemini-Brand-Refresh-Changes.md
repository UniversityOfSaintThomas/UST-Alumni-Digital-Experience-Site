Gemini Brand Refresh Changes Spring 2026 

# Table of Contents 

|**Changes to Page Elements (Not Module Specific) ..................................................................................................................................... 3**|
|---|
|Color Variables ...................................................................................................................................................................................... 4|
|Background Colors ................................................................................................................................................................................ 5|
|Buttons ................................................................................................................................................................................................. 6|
|Text Links .............................................................................................................................................................................................. 7|
|Arrow Links ........................................................................................................................................................................................... 8|
|Headings .............................................................................................................................................................................................. 9|
|Cards ................................................................................................................................................................................................. 10|
|**Changes to Specific Modules ................................................................................................................................................................. 12**|
|Accordion / Accordion with Image ......................................................................................................................................................... 13|
|Call to Action Panel .............................................................................................................................................................................. 15|
|Feature Panel ...................................................................................................................................................................................... 16|
|Hero – Home Page with CTAs................................................................................................................................................................. 20|
|Links List / Links List with Image ............................................................................................................................................................ 21|
|Program Cards..................................................................................................................................................................................... 22|
|Sidebars – Content / Contact Info .......................................................................................................................................................... 23|
|Stats – Background Image ..................................................................................................................................................................... 24|
|Stats – Circles...................................................................................................................................................................................... 25|
|Stats – Feature ..................................................................................................................................................................................... 27|
|Stats – Panels ...................................................................................................................................................................................... 28|
|Table................................................................................................................................................................................................... 29|
|Text Grid .............................................................................................................................................................................................. 30|
|Testimonials – Vertical Scroll ................................................................................................................................................................. 31|



Changes to Page Elements (Not Module Specific) 

## Color Variables 

**Add new color variables and update existing variable hex values in CSS.** 



Purple (--purple): change **existing** variable value from #59007B to #510C76 



Medium Purple (--purple-md): **new** variable set to #8348AD 



Medium Purple, 70% tint (--purple-md-70): **new** variable set to #A97CC6 



Medium Purple, 30% tint (--purple-md-30): **new** variable set to #DAC5E6 



Medium Purple, 20% tint (--purple-md-20): **new** variable set to #E6D8EE 



Medium Purple, 10% tint (--purple-md-10): **new** variable set to #F2EAF6 



Medium Purple, 5% tint (--purple-md-5): **new** variable set to #F8F5F9 



Bright Purple (--purple-lt): change **existing** variable value from #982EB4 to #9E28B5 



Bright Purple, 15% opacity (--purple-lt-25): change **existing** variable value to rgba(158, 40, 181, .1451) 



Emerald Green (--emerald): **new** variable set to #4C9C2E 

## Background Colors 

**Add additional background options as needed, to add flexibility and enable module reuse.** 

- Dark Purple: (--purple-dk) 

- Purple: (--purple) 

- Light Purple: (--purple-md-10) 

- Gray or White, depending on module: (--gray) or (--white) 



<!-- Start of picture text -->
Row Heading<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br><!-- End of picture text -->

## Buttons 

#### **Round corners, adjust hover styles, and adjust padding.** 

- The make buttons look more like buttons, round the corners by adding a large border-radius, e.g.: (border-radius: 9rem;) 

- Then, remove the outline that appears on hover in favor of distinct light and dark hover styles 

   - When set on a dark background, on hover, the button background should be white (--white), with purple text (--purple) 

   - When set on a light background, on hover, the button background should be purple (--purple), with white text (--white) 

- Increase the horizontal padding and reduce the vertical padding to make buttons shorter and wider, e.g.: <mark>`padding: .75em 1.5em;`</mark> 



<!-- Start of picture text -->
Optional Subheading<br>Feature Panel Heading<br>Lorem ipsum dolor sit amet consectetur adipisicing elit. Expedita molestias officia<br>sequi?<br>Call to Action<br><!-- End of picture text -->



<!-- Start of picture text -->
.<br>Feature Panel Heading<br>Lorem ipsum dolor sit amet consectetur adipisicing elit. Expedita molestias officia<br>sequi?<br>Call to Action<br>al<br><!-- End of picture text -->

## Text Links 

**Change link styles for most instances of black underlined to be bright purple.** 

- Change the default text link style from black to bright purple (--purple-lt) 

- Exceptions, which should remain black, include: 

   - Links in Links List modules and sidebars that are accompanied by an arrow icon 

   - Accordion drawer labels that are accompanied by a plus/minus icon 

   - Links denoting an “active” state, such as the “Locations” carousel toggle below 

- When set on a purple or dark purple background, link text should be white (--white) 



<!-- Start of picture text -->
Panel Heading<br>Subheading(3-5 Words) — Optional Link Subheading(3-5 Words) — Optional Link Subheading(3-5 Words) — Optional Link<br>Lorem, ipsum dolor sit amet consectetur Lorem, ipsum dolor sit amet consectetur Lorem, ipsum dolor sit amet consectetur<br>adipisicing elit. Magnam quibusdam adipisicing elit. Magnam quibusdam adipisicing elit. Magnam quibusdam<br>eligendi excepturi accusamus eveniet eligendi excepturi accusamus eveniet eligendi excepturi accusamus eveniet<br>reiciendis, dolore atque cum. reiciendis, dolore atque cum. reiciendis, dolore atque cum.<br><!-- End of picture text -->



<!-- Start of picture text -->
Take Your Next Step (CTA Panel)<br>Learn more about St. Thomas and start yourjoumney toward becoming a Tommie.<br>Request Info VisitaCampus Apply Now.<br><!-- End of picture text -->



<!-- Start of picture text -->
Headline (Visual Router Grid)<br>-<br>nate . > ==<br>vs =a<br>TD I) ae<br>ms<br>Lorem ipsum door st amet consectetur Lorem psu dlr st amet consectetur Lorem, ipsum dolor st amet consectetur<br>acing‘itaque iusto, et dotoremque Incidunt aptdebitis. Eos! quidem tic ‘itaqueadpising iusto,ect doloremquefgdebitis. Eos!quemat ic ‘itaqueadpingiusto, elt doloremque neu fadebitis. Eos!ute atc<br><!-- End of picture text -->



<!-- Start of picture text -->
. .<br>Headline (Toggle Carousel - Specialty<br>Component)<br>Paragraph Text (1-3 sentences) — Sit amet, consectetur<br>adipiscing elit, sed do eiusmod tempor incididunt. Sit amet,<br>consectetur adipiscing elit, sed do eiusmod.<br>Locations —_ Traditions<br><!-- End of picture text -->

## Arrow Links 

#### **Adjust Links List links to always show the arrow icon; adjust hover styles and background color** 

- In full-width and narrow row Links List modules, show a bright purple (--purple-lt) arrow icon next to each link. On hover, change the icon to show a white arrow (--white), on a bright purple (--purple-lt) circle background, change the text color to bright purple (--purple-lt), and move the circle icon 1rem to the right. 

- In the sidebar row Links List module, show the existing bright purple arrow with no background by default. On hover, change the text color to bright purple, and move the arrow icon .5rem to the right. 



<!-- Start of picture text -->
Headline (Router Panel)<br>Paragraph Text (1-3 sentences) — Sit amet, consectetur adipiscing elit, sed do<br>eiusmod ternpor icici. it amet, consectetur adipiscing et, sed do esmod<br>= *<br>Router Link (>)<br>a Router Link ><br>ks—~ ian “<br>— Router Link =)<br><!-- End of picture text -->



<!-- Start of picture text -->
Related Links<br>Lorem ipsum dolor sit amet consectetur. 5<br>Lorem ipsum dolor sit amet consectetur. fy =><br>Lorem ipsum dolor sit amet consectetur. ><br><!-- End of picture text -->

## Headings 

**Make H2s purple to add color to the page, change H3s and below to Lato for increased distinction between headings.** 

- Change H2s to purple (--purple) 

- Change H3, H4, H5, and H6 from Lora to Lato font 



<!-- Start of picture text -->
Lorem, ipsum.<br>Lorem ipsum dolor, sit amet consectetur<br>adipisicing elit. Veritatis ipsum reiciendis<br>dolore!<br>Phone:‘Send Emallgoo<br>Phone: 800-555-5555<br>Fax: 800-555-5555<br><!-- End of picture text -->



<!-- Start of picture text -->
Headline (Paragraph - Body)<br>Paragraph Text — Lorem ipsum dolor sit amet, cetero aliquam feugiat id sea. Ea case nullam<br>consulat qu, autem abhorreant elaboraret et st. Pro insoles ullamcorper ut. Odio his eam<br>ignotacu, in sea nam,salutandi cum et assumassentior. alienum.Bonorumid has dicunt corporaeleifend at nam, ad ratonibus,vis habeo vipericulis. llum domingTe quas legere<br>interpretaris ad, quot voluptatibus et pro.<br><!-- End of picture text -->



<!-- Start of picture text -->
Related Links<br>Lorem ipsum|  dolor sit;  amet consectetur. md<br>Lorem ipsum dolor sit amet consectetur. ><br>:<br>Lorem ipsum dolor sit amet consectetur. ><br><!-- End of picture text -->



<!-- Start of picture text -->
Headline (Accordion)<br>Accordion Item ar<br>Accordion Item +<br>Aecordon tem ‘<br><!-- End of picture text -->



<!-- Start of picture text -->
Panel Heading<br>Subheading (3-5 Words) Subheading (3-5 Words) ‘Subheading (3-5 Words)<br>Lorem, ipsum dolor sit amet consectetur Lorem, ipsum dolor sit amet consectetur Lorem, ipsum dolor sit amet consectetur<br>aciisking et Magnam qubusdam elgenci_—_adiiing elt. Magnam qubusdam egendi alg elt. Magnam quibusdam eigen<br>ceceptr ccusamus<br>door evene ried cecepturl ccusamusevena ind cecepturl crusamusvena rekiendls,<br>stave cum door stave cum, door tue cum,<br><!-- End of picture text -->

## Cards 

#### **Lighten card description area, adjust box shadow and hover interaction.** 

- Change the card description background color to white (--white) 

- Add a drop shadow to the cards in their default (non-hover) state: <mark>`box-shadow: 0 1em 2em var(--black-10);`</mark> 

- On hover, instead of increasing the card’s shadow, change the bottom border color to bright purple (--purple-lt), and increase the bottom border thickness to 8px. 

- Remove the Color option that specifies a bottom border color from _individual_ cards. Add a color option that lets you specify the bottom border color for _all_ cards. It should default to Green (--emerald) but retain a None option. 

- **_Fix_** : In Cascade, the card description text is rendered in between empty paragraph elements. Please move the content into the paragraph above (with the .t-sm class applied to it) so this text is slightly smaller than regular body text. 



<!-- Start of picture text -->
Headline (Visual Router Grid)<br>RAMANA<br>\\ a »\SS. \ *\<br>WIA RA AS MN (=<br>\ WY \ 4 ==...<br>Lorem, ipsum dolor. Lorem, ipsum dolor. Lorem, ipsum dolor.<br>adipisicLorem, i ngpsumelit. dolorIncidunt sit ametfugit consectetur quidem at hic adipisicLorem, i ngpsumelit. dolorIncidunt sit amet fugit consectetur quidem at hic adipisicLorem, i ngpsumelit. dolorIncidunt sit ametfugitconecetgy quidem at<br>itaque iusto, doloremque debitis. Eos! itaque iusto, doloremque debitis. Eos! itaque iusto, doloremque debits. Eos!<br>a<br><!-- End of picture text -->

#### **Add 4 background options; change accent color to emerald** 

- Dark Purple (--purple-dk) 

- Purple (--purple) 

- Light Purple (--purple-md-10) 

- White (--white) 



<!-- Start of picture text -->
Row Heading<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br>Finding Forward: The<br>St. Thomas Nightat MN Tommies Together: Career<br>Century<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br>Finding Forward: The St. Thomas Nightat MN Tommies Together: Career<br>Century<br><!-- End of picture text -->

Changes to Specific Modules 

## Accordion / Accordion with Image 

**Add background color options, change drawer colors and plus/minus icons from grays to purples, adjust subheading style** 

- In addition to the default White (--white) background color, please add Light Purple (--purple-lt), Purple (--purple), and Dark Purple (-purple-dk) background options. 

   - For the white background version: 

      - Change the background color of accordion drawers in their default state to Medium purple, 10% tint (--purple-md-10) 

      - On hover/focus and when expanded, change the drawer background color to Medium purple, 20% tint (--purple-md-20) 

      - Change the background color of the content area (.Accordion__content) to Medium purple, 5% tint (--purple-md-5) 

   - For the light purple, purple, and dark purple versions: 

      - Darken the accordion drawers in their default state to Medium purple, 20% tint (--purple-md-20) 

      - On hover/focus and when expanded, darken the drawer background to Medium purple, 30% tint (--purple-md-30) 

      - Keep the background color of the content area (.Accordion__content) as Medium purple, 5% tint (--purple-md-5) 

- Please also change the accordion subheading to Lato Bold at ~1.25rem. 

- And change the plus/minus icons to light purple (--purple-lt). 

- **_Fix_** : In Cascade, when the accordion drawer label wraps to multiple lines, the plus/minus icon gets stretched and skewed. 

### Accordion 



<!-- Start of picture text -->
Accordion Item +<br>Accordion Item x<br>Optional Subheading<br>Lorem ipsum dolor sit amet, consectetur adipscng el, sed do eusmod tempor incdidunt ut abore<br>{et dolore magna, Lorem ipsum dolor sit amet, consectetur aipicng elt, sed do elusmod tempor<br>inciidunt ut labore et dolore magna<br>Lorem ipsum dolor sit amet consectetur adipiscing elt. Nequeiure rem incidunt corrupt temporibus<br>vel aperiam expedita ilo consequatur, ius cupditate, laboriosam lust libero vitae ipsa praesentum<br>perspiciatis nis, Eum amet fais ducimus nescunt voluptatem<br>repellat necessitatbus digrssimos vl sit quisquam, culpa vitae!a ld?audantium excepturl magnam<br>Accordion Item +<br><!-- End of picture text -->



<!-- Start of picture text -->
Accordion<br><!-- End of picture text -->



<!-- Start of picture text -->
Accordion Item +<br>Accordion Item x<br>Optional Subheading<br>Lorem ipsum dolor sit amet, consectetur adipscng el, sed do eusmod tempor incdidunt ut abore<br>{et dolore magna, Lorem ipsum dolor sit amet, consectetur aipicng elt, sed do elusmod tempor<br>inciidunt ut labore et dolore magna<br>Lorem ipsum dolor sit amet consectetur adipiscing elt. Nequeiure rem incidunt corrupt temporibus<br>vel aperiam expedita ilo consequatur, ius cupditate, laboriosam lust libero vitae ipsa praesentum<br>perspiciatis nis, Eum amet fais ducimus nescunt voluptatem<br>repellat necessitatbus digrssimos vl sit quisquam, culpa vitae!a ld?audantium excepturl magnam<br>Accordion Item +<br><!-- End of picture text -->



<!-- Start of picture text -->
Accordion<br><!-- End of picture text -->



<!-- Start of picture text -->
Accordion Item +<br>Accordion Item x<br><!-- End of picture text -->



<!-- Start of picture text -->
Optional Subheading<br><!-- End of picture text -->



<!-- Start of picture text -->
Lorem ipsum dolor sit amet, consectetur adipiscing elt, sed do elusmod tempor inciidunt ut labore<br>et dolore magna, Lorem ipsum dolor sit amet, consectetur adipiscing elt, sed do elusmmod tempor<br>inciidunt ut labore et dolore magna<br>Lorem ipsum dolor st amet consectetur adipiscing elt. Neque ure rem incidunt corrupt temporibus<br>vel,persica aperam nis, expeEum ametilo consequat, facilis ducimus nescunt us cupiditat,laboriosam voluptatem a laudantiumisto libero exceptur vite psa magnampraesentium<br>repellat necessitatibus digrssimos vel st quisquam, culpa vitae! 1d?<br><!-- End of picture text -->



<!-- Start of picture text -->
Accordion Item +<br><!-- End of picture text -->



<!-- Start of picture text -->
Accordion<br><!-- End of picture text -->



<!-- Start of picture text -->
Accordion Item +<br>Accordion Item x<br><!-- End of picture text -->



<!-- Start of picture text -->
Optional Subheading<br><!-- End of picture text -->



<!-- Start of picture text -->
Lorem ipsum dolor sit amet, consectetur adipiscing elt, sed do elusmod tempor inciidunt ut labore<br>et dolore magna, Lorem ipsum dolor sit amet, consectetur adipiscing elt, sed do elusmmod tempor<br>inciidunt ut labore et dolore magna<br>Lorem ipsum dolor st amet consectetur adipiscing elt. Neque ure rem incidunt corrupt temporibus<br>vel,persica aperam nis, expeEum ametilo consequat, facilis ducimus nescunt us cupiditat,laboriosam voluptatem a laudantiumisto libero exceptur vite psa magnampraesentium<br>repellat necessitatibus digrssimos vel st quisquam, culpa vitae! 1d?<br><!-- End of picture text -->



<!-- Start of picture text -->
Accordion Item +<br><!-- End of picture text -->

## Call to Action Panel 

**Add background color options, change rings to green, and make full-width** 

- Please add additional background colors: 

   - Dark Purple (--purple-dk) 

   - Purple (--purple) 

   - Light Purple (--purple-md-10) 

   - Gray (--gray) 

   - _Note, we should also keep the background image option._ 

- **_Fix_** : Please reinstate the full-width nature of this module, so it extends beyond the left and right edges of the max content width to fill the entire width of the viewport. 







<!-- Start of picture text -->
Row Heading<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br><!-- End of picture text -->

## Feature Panel 

#### **4 background options with circles: green OR purple** 

- In lieu of a single module option, that controls both the module’s background color and the accent graphic and color, we’d like to move to separate module options to control the background and accent graphic styles independently. 

   - Background Color: Dark Purple, Purple, Light Purple, Gray 

   - Accent pattern: Green Circles, Purple circles, Stained Glass, None. 



<!-- Start of picture text -->
Row Heading cae é<br>ei noe eC | a<br>Button Label) SecondaryCall to Action ee © ee<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading eae<br>LoreeSm sc aca ead x l aet<br>Button Label ) SecondaryCall toAction ae a Sa<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading cae é<br>lire oesnae cia sseecrs ars = od ¢ | a<br>Button Label) SecondaryCall to Action an ©<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading eae<br>oreoSrsocio sects stan em x { l ae t<br>Button Label) SecondaryCall to Action ae a Sa<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading h i 7<br>i. | Pits ee<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading w= 7<br>. re fas<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Headin; h : 4<br>2 oem<br>©®<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Headin; i : 4<br>2 ——— i<br>©®<br><!-- End of picture text -->

#### Color info (left to right, top to bottom): 

1. Background: Dark Purple (--purple-dk); Fill circle: Purple (--purple); Line circles: Green (--emerald) 

2. Background: Dark Purple (--purple-dk); Fill circle: Purple (--purple); Line circles: Medium Purple, 70% tint (--purple-md-70) 

3. Background: Purple (--purple); Fill circle: Dark Purple (--purple-dk); Line circles: Green (--emerald) 

4. Background: Purple (--purple); Fill circle: Dark Purple (--purple-dk); Line circles: Medium Purple, 70% tint (--purple-md-70) 

5. Background: Light Purple (--purple-md-10); Fill circle: Medium Purple, 30% tint (--purple-md-30); Line circles: Green (--emerald) 

6. Background: Light Purple (--purple-md-10); Fill circle: Medium Purple, 30% tint (--purple-md-30); Line circles: Medium Purple, 70% tint (--purple-md-70) 

7. Background: Gray (--gray); Fill circle: Medium Purple, 20% tint (--purple-md-20); Line circles: Green (--emerald) 

8. Background: Gray (--gray); Fill circle: Medium Purple, 20% tint (--purple-md-20); Line circles: Medium Purple, 70% tint (--purple-md-70) 

- **4 background options with stained glass** 

   - Dark Purple (--purple-dk) & Purple (--purple): Stained glass icon in Medium Purple (--purple-md) at 30% opacity 

   - Light Purple (--purple-md-10) & Gray (--gray): Stained glass icon in Medium Purple (--purple-md) at 10% opacity ( _currently: 6%)_ 



<!-- Start of picture text -->
Row Heading aa 5<br>iu we ° ey,<br>BURNED) secondary<br>Callto Action eae © ee<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading aa é<br>- we 3 pies<br>BENE) secondaryCallto Action eae © ee<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading a ye,<br>Lorem ipsum dolor sit amet consectetur<br>adipiscing elit. Expedia SSyiey" : ii 7]<br>Secondary Call to Action meet ek° peea =<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading a ye,<br>consectetur adipiscing elit Expedita<br>Lorem ipsum dolor sit amet . ' Mi a<br>Secondary Call to Action SNS,me emi)ak ie Wesae<br><!-- End of picture text -->

**4 background options with no iconography** 



<!-- Start of picture text -->
Row Heading5 Rare= | ¢ é<br>Button Label) SecondaryCall to Action ur = ae<br>\ § ey 2, fg<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading Rar ae Z<br>tren um db tameconsecrateet edt ni : NY spe<br>Secondary Callto Action aemaa ‘aa© eaei ©<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading eae<br>= ge BE ¢ Us<br>Button Label) SecondaryCall to Action We ic "ie<br>ESS ee =,<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading Ree ae é<br>trem nn lr St met osc asi Expt ni) E NY spe<br>Secondary Call to Action PR a eyyat ‘ae& PeE e e,<br><!-- End of picture text -->

## Hero – Home Page with CTAs 

**Adjust colors and CTA styles** 

- Change line color to green (--emerald) 

- Change the font style of the CTA heading from italic to regular. 

- Remove all-caps from the arrow link and underline by default (using <mark>`.link-underline--reverse` )</mark> . 

- **_Future phase_** : On mobile, remove the pagination from the CTAs and show them all by default (needs styling) 



<!-- Start of picture text -->
e St Thomas About * Academics * Admissions&Aid + Student Life * Athletics » Q Visit G& Apply Q<br>1 ie aie: (Bal<br>—— “es ae<br>TOI iii4 : a<br>We're ALL FOR Building<br>Lifelong Connections<br>Undergraduate Programs Visit St. Thomas Financial Support<br>Find your major or minor —> Schedule your campus visit —> Discover scholarships & financial aid |—><br>iS<br><!-- End of picture text -->

## Links List / Links List with Image 

#### **Remove partial background color** 

- In addition to the changes to arrow links, please remove the background gradient that currently adds gray behind 2/3rds of the module at larger screen sizes. 

- In a future phase, this module should gain additional background color options (that span the full width of the module). 



<!-- Start of picture text -->
Headline (Router Panel)<br>Paragraph Text (1-3 sentences) — Sit amet, consectetur adipiscing elit, sed do<br>elusmod tempor incididunt. Sit amet, consectetur adipiscing elit, sed do eiusmod.<br>= =<br>Router Link >)<br>f eC = Router Link 4<br>saa Wi<br>— F: tet Router Link ><br>ag- Router Link =}<br>&&<br><!-- End of picture text -->

## Program Cards 

**Remove transparent circles and hover text, move link to Small Text field, adjust font styles** 

- Change the transparent accent circles to white outlines at 70% opacity and add a module option to disable them 

- Remove link that is currently shown below the card subheadings on hover, and move the link functionality to the subheading 

- • Change the subheading field to Lato 



<!-- Start of picture text -->
We're ALL FOR Academic Excellence, Refined over<br>140+ Years<br>|<br>.<br>150+ 55+<br>Undergraduate Majors Graduate<br>and Minors 8 Programs & Professional<br><!-- End of picture text -->



<!-- Start of picture text -->
A Tradition of Excellence<br>150+ 25+<br>Minors 995as & Profigssional Online Courses<br><!-- End of picture text -->

## Sidebars – Content / Contact Info 

**Change background color and heading underline color** 

- Change the background color of the Content and Contact Info sidebars to Medium Purple, 10% tint (--purple-md-10) 

- Change the line underneath the H2 to Green (--emerald) 



<!-- Start of picture text -->
Lorem, ipsum.<br>Lorem ipsum dolor, sit amet consectetur<br>adipisicing elit. Veritatis ipsum reiciendis<br>dolore!<br>Send Email<br>Phone: 800-555-5555<br>Fax: 800-555-5555<br><!-- End of picture text -->

## Stats – Background Image 

**Change line color to green, add background color options so an image isn’t required** 

- Change the stat underline accent color to Green (--emerald) 

- Add background color options that negate the need for a background image 

   - Dark Purple (--purple-dk), Purple (--purple) 

   - Light Purple (--purple-md-10), Gray (--gray) 

- Once this image no longer requires a background image, please also rename the module to Stats – Lines 



<!-- Start of picture text -->
Facts & Figures<br>34k 2nd 96%(e)<br>Lorem ipsum,<br>dolor sit amet Lorem ipsum, dolorsit amet Lorem ipsum, dolor st amet<br><!-- End of picture text -->



<!-- Start of picture text -->
Facts & Figures<br>34k 2nd 96%(e)<br>Lorem ipsum, dolor sit amet Lorem ipsum, dolor sit amet Lorem ipsum, dolor sit amet<br><!-- End of picture text -->

## Stats – Circles 

**2 background color options, 2 accent color options – 4 total** 

- Please add additional background colors: 

   - Dark Purple (--purple-dk) 

   - Purple (--purple) 

   - Light Purple (--purple-md-10) 

   - Gray (--gray) 

- In a future phase, this module should gain additional background color options (that span the full width of the module). 



<!-- Start of picture text -->
Row Heading<br>97% 97% 97%<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br>97% 97% 97%<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br>97% 97% 97%<br>Lorem ipsum Lorem ipsum Lorem ipsum<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br>97% 97% 97%<br>Lorem ipsum Lorem ipsum Lorem ipsum<br><!-- End of picture text -->

#### Hex code info (left to right, top to bottom): 

1. Background: Dark Purple (--purple-dk); Lines: Green (--emerald); Circles: #54018F to #B751FF 

2. Background: Dark Purple (--purple-dk); Lines: White (--white); Circles: #154D00 to #49C51B 

3. Background: White (--white); Lines: Green (--emerald); Circles: #54018F to #B751FF 

4. Background: White (--white); Lines: Medium Purple (--purple-md); Circles: #154D00 to #49C51B 

## Stats – Feature 

#### **_Remove module from Gemini_** 

- This module is unlikely to ever be used. It can be removed from Gemini. 

## Stats – Panels 

#### **_Remove circles from cards, change accent to green_** 

- Remove the circles from the bottom right corner of the cards and extend the card description to the full width of the card 

- Change the stat underline accent color to Green (--emerald) 

- Add a drop shadow to the panels (not currently shown in mockups): <mark>`box-shadow: 0 1em 2em var(--black-10);`</mark> 



<!-- Start of picture text -->
Row Heading<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br>150+ eerie 150+ ness<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br><!-- End of picture text -->



<!-- Start of picture text -->
Row Heading<br>150+ vice tors TS0+ seas<br><!-- End of picture text -->

## Table 

#### **Change colors and font styles, add add mobile layout and footnotes field** 

- Add a new WYSIWYG content field below the table for Footnotes. This can be styled the same as the description field above the table. 

- Change the background color of the table head to Medium purple 10% tint (--purple-md-10) 

- Change the border of the table head to a 2px thick line of transparent bright purple (--purple-lt-25) 

- Change header cells to Lato Bold 

- Change the background color of alternating table rows ( <mark>`tr:nth-child(2n)` )</mark> to a Medium purple, 5% tint (--purple-md-5) 

- Add a bottom border to the last table row in the table ( <mark>`tr:last-of-type`</mark> ) that is a 2px thick line of transparent bright purple (--purple-lt-25) 

- On mobile, move the table head border from the bottom to the top of the cell, and reduce the font weight of row headers to 400. 

- Please ensure these styles apply to tables within manually created tables within accordion drawers (see 3<sup>rd</sup> screenshot) 

- **_Nice to have_** : to give us control over column widths on desktop, add a Width option to each column header that accepts a percentage number and adds it to the front end as an inline style: <mark>`<th scope="column" style="width:[width-cascade-field]%">`</mark> 



<!-- Start of picture text -->
Desktop Table<br>Column 0 Column 3 Colum 2 Colum 3<br>Row Lorem ipsum Lorem sum Lorem ipsum<br>Row? Lorem ipsum Lorem ipsum Lorem ipsum<br>Rows Lorem ipsum Lorem ipsum Lorem ipsum<br>Lorem sum Lorem sum Lorem sum<br>Rows<br><!-- End of picture text -->



<!-- Start of picture text -->
Mobile Table<br>column0<br>ow’<br>column 4<br>Lorem ipsum<br>column2<br>‘eum<br>cota 3<br>Lorem ipsum<br>conn0<br>row?<br>Coloma t<br>Loremipsum<br>en<br>Lorem ipsum<br>Lorem ipsum<br>cota 3<br><!-- End of picture text -->



<!-- Start of picture text -->
Accordion Item x<br>Lorem ipsum dolr sit amet, consectetur adipiscing elit sed do elusmod tempor inciidunt ut labore et<br>dolore magna. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt<br>ut labore et dolore magna<br>Column 0 ‘Column 1 Column 2 Column3<br>Rows Lorem ipsum Lorem ipsum Lorem ipsum<br>Row? Lorem ipsum Lorem ipsum Lorem ipsum<br>Row3 Lorem ipsum Lorem ipsum Lorem ipsum<br>Row4 Lorem ipsum Lorem ipsum Lorem ipsum<br>Rows Lorem ipsum Lorem ipsum Lorem ipsum<br><!-- End of picture text -->

## Text Grid 

**Extend background color to cover full viewport width** 

- Please extend the edges of the background color to cover the full width of the viewport on large screens. 

## Testimonials – Vertical Scroll 

**Increase left column width on desktop, adjust color and font styles** 

- On desktop, remove the left padding from the left column and increase the line width of the “What it Mean to Be a Tommie” content 

- Remove the background gradient that currently adds gray behind 2/3rds of the module at larger screen sizes 

- Add <mark>`.link-underline--reverse`</mark> to the story link so it’s underlined by default 

- Add an mdash before the attribution field (using a <mark>`:before`</mark> pseudo selector) for consistency with other quote modules 

- Change the accent circle colors to alternate between solid Medium Purple (--purple-md) and outline Green (--emerald) 



<!-- Start of picture text -->
What it Means to ~ i a<br>Be a Tommie; (asAz eit<br>Meet sents and alum woe stove he<br>“Going to college for journalism isa<br>rare career path, but | want to break<br>that barrier and allow there to be more<br>‘opportunities for Hmong people.”<br>~ Gomer<br>ang 26<br>"We have access to this<br>wonderful network. We have —<br>wonderful advisors ~ all these<br>people who are supporting us aeons YY<br>along the way” BaP apn t Be<br>: i, Tei<br><!-- End of picture text -->


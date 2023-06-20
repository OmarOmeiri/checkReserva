from pushbullet import PushBullet
import sys

title = sys.argv[1]
value = sys.argv[2]
print(title)
print(value)


access_token = "o.VFR3MCREvIJ6wABj6vNWqFSB0mXQJn4R"

# Get the instance using access token
pb = PushBullet(access_token)

# Send the data by passing the main title
# and text to be send
push = pb.push_note(title, value)
